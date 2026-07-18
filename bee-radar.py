#!/usr/bin/env python3
"""
Bee Radar - Deteção de Atividade de Abelhas via WiFi
Adaptado do WiFi Radar D-Link para monitorização de colmeias.

Funcionamento:
- Scan das redes WiFi nearby
- Abelhas a voar causam micro-mudanças no sinal WiFi (corpos hídricos)
- Filtro Wiener remove ruído (vento, temperatura)
- Threshold autônomo adapta-se ao ambiente
- Envia dados para o servidor Express via HTTP

Uso:
  python bee-radar.py [--server http://localhost:3001] [--interval 2]
"""

import subprocess
import re
import time
import json
import sys
import math
import statistics
import urllib.request
import urllib.error
from collections import deque
import argparse


class KWienerFilter:
    """Filtro Kolmogorov-Wiener - remove ruído do sinal WiFi."""

    def __init__(self, window_size=20):
        self.window_size = window_size
        self.buffer = deque(maxlen=window_size)

    def filter(self, value):
        self.buffer.append(value)
        if len(self.buffer) < 3:
            return value

        data = list(self.buffer)
        mean = statistics.mean(data)
        var = statistics.variance(data) if len(data) > 1 else 1.0

        diffs = [abs(data[i] - data[i - 1]) for i in range(1, len(data))]
        noise_var = statistics.mean(diffs) ** 2 if diffs else 0.5

        if var + noise_var > 0:
            gain = var / (var + noise_var)
        else:
            gain = 0.5

        filtered = mean + gain * (value - mean)
        return filtered

    def get_variance(self):
        if len(self.buffer) < 3:
            return 0.0
        return statistics.variance(list(self.buffer))

    def get_noise_estimate(self):
        if len(self.buffer) < 3:
            return 1.0
        data = list(self.buffer)
        diffs = [abs(data[i] - data[i - 1]) for i in range(1, len(data))]
        return statistics.mean(diffs) if diffs else 0.5


class AutoThreshold:
    """Threshold Autônomo - adapta-se ao ambiente."""

    def __init__(self, history_size=60):
        self.history = deque(maxlen=history_size)
        self.threshold = 0.2
        self.base_threshold = 0.2

    def update(self, value):
        self.history.append(value)
        if len(self.history) < 10:
            self.threshold = self.base_threshold
            return

        data = list(self.history)
        mean = statistics.mean(data)
        std = statistics.stdev(data) if len(data) > 1 else 0.1

        self.threshold = max(self.base_threshold, mean + 1.5 * std)

    def is_significant(self, value):
        return abs(value) >= self.threshold

    def get_threshold(self):
        return self.threshold


class BeeWiFiScanner:
    """Scanner WiFi para deteção de atividade de abelhas."""

    def __init__(self):
        self.baselines = {}
        self.calibrated = False
        self.total_scans = 0
        self.detections = 0
        self.start_time = time.time()
        self.filters = {}
        self.auto_thresholds = {}
        self.momentum = 0
        self.energy_window = deque(maxlen=5)
        self.detection_state = 0
        self.state_counter = 0

    def pct_to_dbm(self, pct):
        if pct <= 0:
            return -100.0
        if pct >= 100:
            return -50.0
        dbm = -50 - (50 * (1 - pct / 100) ** 1.8)
        return round(dbm, 1)

    def scan_networks(self):
        try:
            result = subprocess.run(
                ['netsh', 'wlan', 'show', 'networks', 'mode=bssid'],
                capture_output=True, text=True, timeout=10,
                encoding='cp1252', errors='replace'
            )
            networks = {}
            current_ssid = None
            current_signals = []

            for line in result.stdout.split('\n'):
                line = line.strip()
                ssid_match = re.search(r'^SSID\s+\d+\s*:\s*(.+)', line)
                if ssid_match:
                    if current_ssid and current_signals:
                        if current_ssid not in networks:
                            networks[current_ssid] = []
                        networks[current_ssid].extend(current_signals)
                    current_ssid = ssid_match.group(1).strip()
                    current_signals = []

                if current_ssid and ('Sinal' in line or 'Signal' in line):
                    signal_match = re.search(r'(\d+)%', line)
                    if signal_match:
                        pct = int(signal_match.group(1))
                        dbm = self.pct_to_dbm(pct)
                        current_signals.append(dbm)

            if current_ssid and current_signals:
                if current_ssid not in networks:
                    networks[current_ssid] = []
                networks[current_ssid].extend(current_signals)

            avg = {}
            for ssid, signals in networks.items():
                if signals:
                    avg[ssid] = sum(signals) / len(signals)
            return avg
        except Exception:
            return {}

    def calibrate(self, scans=30):
        print("[*] Calibrando... fique PARADO e AFASTADO do router", flush=True)
        baselines_sum = {}
        baselines_count = {}

        for i in range(scans):
            networks = self.scan_networks()
            for ssid, signal in networks.items():
                if ssid not in baselines_sum:
                    baselines_sum[ssid] = 0
                    baselines_count[ssid] = 0
                baselines_sum[ssid] += signal
                baselines_count[ssid] += 1
            sys.stdout.write(f"\r    Scan {i + 1}/{scans}    ")
            sys.stdout.flush()
            time.sleep(0.3)

        print(flush=True)

        self.baselines = {}
        for ssid in baselines_sum:
            if baselines_count[ssid] > 0:
                self.baselines[ssid] = baselines_sum[ssid] / baselines_count[ssid]
                self.filters[ssid] = KWienerFilter(window_size=20)
                self.auto_thresholds[ssid] = AutoThreshold(history_size=60)

        self.calibrated = True
        print(f"[OK] Calibrado com {len(self.baselines)} rede(s)!", flush=True)
        for ssid, b in self.baselines.items():
            print(f"     {ssid}: {b:.1f} dBm", flush=True)
        return len(self.baselines) > 0

    def analyze(self):
        if not self.calibrated:
            return None

        networks = self.scan_networks()
        self.total_scans += 1

        if not networks:
            return None

        changes = {}
        total_energy = 0
        significant = []
        filter_info = {}

        for ssid, baseline in self.baselines.items():
            if ssid in networks:
                raw_value = networks[ssid]
                filtered_value = self.filters[ssid].filter(raw_value)
                change = round(filtered_value - baseline, 2)
                abs_change = abs(change)

                changes[ssid] = change

                at = self.auto_thresholds[ssid]
                threshold = at.get_threshold()

                if abs_change < threshold * 0.5:
                    at.update(abs_change)

                signal_var = self.filters[ssid].get_variance()
                noise_est = self.filters[ssid].get_noise_estimate()

                filter_info[ssid] = {
                    'raw': round(raw_value, 1),
                    'filtered': round(filtered_value, 1),
                    'threshold': round(threshold, 2),
                    'noise': round(noise_est, 2),
                    'variance': round(signal_var, 3)
                }

                if at.is_significant(abs_change):
                    energy_contrib = abs_change - threshold
                    total_energy += max(0, energy_contrib)
                    significant.append({
                        'ssid': ssid,
                        'change': change,
                        'abs': abs_change
                    })
                elif signal_var > 1.0:
                    total_energy += min(signal_var * 0.3, 0.5)

        self.momentum = self.momentum * 0.7 + total_energy * 0.3
        smoothed_energy = self.momentum

        self.energy_window.append(smoothed_energy)
        avg_energy = statistics.mean(self.energy_window) if self.energy_window else 0

        bee_activity = 0
        if avg_energy > 0.15:
            bee_activity = 1
        if avg_energy > 0.8:
            bee_activity = 2
        if avg_energy > 2.0:
            bee_activity = 3

        if bee_activity > 0:
            self.state_counter = min(self.state_counter + 1, 5)
            if self.state_counter >= 2:
                self.detection_state = 2
                self.detections += 1
            else:
                self.detection_state = 1
        else:
            self.state_counter = max(self.state_counter - 1, 0)
            if self.state_counter == 0:
                self.detection_state = 0

        final_activity = bee_activity if self.detection_state == 2 else 0

        now = time.strftime("%H:%M:%S")
        return {
            'time': now,
            'ts': time.time(),
            'changes': changes,
            'significant': len(significant),
            'total_energy': round(avg_energy, 3),
            'raw_energy': round(total_energy, 3),
            'bee_activity': final_activity,
            'possible_bees': bee_activity,
            'detection_state': self.detection_state,
            'details': significant[:5],
            'filters': filter_info,
            'networks_count': len(networks)
        }

    def send_to_server(self, data, server_url):
        try:
            payload = json.dumps(data).encode('utf-8')
            req = urllib.request.Request(
                f'{server_url}/api/beedata',
                data=payload,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            urllib.request.urlopen(req, timeout=5)
            return True
        except Exception as e:
            print(f"[ERRO] Falha ao enviar: {e}", flush=True)
            return False


def main():
    parser = argparse.ArgumentParser(description='Bee Radar - Deteção de Abelhas via WiFi')
    parser.add_argument('--server', default='http://localhost:3001', help='URL do servidor Express')
    parser.add_argument('--interval', type=float, default=2.0, help='Intervalo entre scans (segundos)')
    args = parser.parse_args()

    print("=" * 55, flush=True)
    print("  Bee Radar - Deteção de Atividade de Abelhas", flush=True)
    print("  Via análise de sinais WiFi", flush=True)
    print("=" * 55, flush=True)

    scanner = BeeWiFiScanner()

    if not scanner.calibrate():
        print("[ERRO] Calibração falhou. Verifique o adaptador WiFi.", flush=True)
        return

    print(f"\n[*] Radar ativo (scan a cada {args.interval}s) - Ctrl+C para parar", flush=True)
    print(f"    Servidor: {args.server}", flush=True)
    print(f"    Pressione Ctrl+C para parar\n", flush=True)

    last_activity = 0
    try:
        while True:
            data = scanner.analyze()
            if data:
                ts = data['time']
                nrg = data['total_energy']
                act = data['bee_activity']

                if act > 0 and act != last_activity:
                    print(f"[{ts}] !!! ATIVIDADE DETETADA ({act}) - Energia: {nrg:.3f} !!!", flush=True)
                    for d in data['details']:
                        print(f"         {d['ssid']}: {d['change']:+.1f} dBm", flush=True)
                elif act == 0 and last_activity > 0:
                    print(f"[{ts}] [ok] Área tranquila - Energia: {nrg:.3f}", flush=True)
                elif act > 0:
                    print(f"[{ts}] [!!] Atividade ({act}) - Energia: {nrg:.3f}", flush=True)

                last_activity = act

                scanner.send_to_server(data, args.server)

            time.sleep(args.interval)
    except KeyboardInterrupt:
        dur = int(time.time() - scanner.start_time)
        print(f"\n\n=== Relatório Final ===", flush=True)
        print(f"  Scans: {scanner.total_scans}", flush=True)
        print(f"  Deteções: {scanner.detections}", flush=True)
        print(f"  Duração: {dur}s", flush=True)
        print("[OK] Terminado.", flush=True)


if __name__ == "__main__":
    main()
