import React, { useEffect, useRef } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Home: React.FC = () => {
    const navigate = useNavigate();
    const videoRef1 = useRef<HTMLVideoElement>(null);
    const videoRef2 = useRef<HTMLVideoElement>(null);
    const techVideoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (techVideoRef.current) techVideoRef.current.playbackRate = 2.0;

        const videos = [videoRef1.current, videoRef2.current];
        let currentIndex = 0;
        let transitioning = false;

        const playNext = () => {
            if (transitioning) return;
            transitioning = true;

            const current = videos[currentIndex];
            currentIndex = (currentIndex + 1) % videos.length;
            const next = videos[currentIndex];

            if (current && next) {
                next.currentTime = 0;
                next.play().then(() => {
                    next.classList.replace('opacity-0', 'opacity-100');
                    current.classList.replace('opacity-100', 'opacity-0');

                    setTimeout(() => {
                        current.pause();
                        transitioning = false;
                    }, 1500);
                });
            }
        };

        const intervals = videos.map(v => {
            if (v) {
                v.playbackRate = 2.0;
                const handleTimeUpdate = () => {
                    if (!transitioning && v.duration - v.currentTime < 2) {
                        playNext();
                    }
                };
                v.addEventListener('timeupdate', handleTimeUpdate);
                return () => v.removeEventListener('timeupdate', handleTimeUpdate);
            }
            return () => { };
        });

        return () => intervals.forEach(cleanup => cleanup());
    }, []);

    return (
        <div className="bg-background-light font-display text-slate-900 antialiased overflow-x-hidden">
            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 glass-nav border-b border-primary/10">
                <div className="max-w-7xl mx-auto px-6 h-12 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">
                            BeeHealth <span className="text-primary-dark">IA</span>
                        </h1>
                    </div>
                    <div className="hidden md:flex items-center gap-10">
                        <a className="text-sm font-medium hover:text-primary transition-colors" href="#missao">A Nossa Missão</a>
                        <a className="text-sm font-medium hover:text-primary transition-colors" href="#tecnologia">Tecnologia</a>
                        <button onClick={() => navigate('/dashboard')} className="text-sm font-medium hover:text-primary transition-colors">Dashboard</button>
                        <button onClick={() => navigate('/map')} className="text-sm font-medium hover:text-primary transition-colors">Mapa</button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/login')} className="px-5 py-2 text-sm font-bold hover:bg-slate-100 rounded-lg transition-all">Entrar</button>
                        <button onClick={() => navigate('/signup')} className="bg-primary text-background-dark px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
                            Cadastrar
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative min-h-screen flex items-center pt-20 overflow-hidden">
                <div className="absolute inset-0 z-0 video-docker overflow-hidden bg-slate-900">
                    <video ref={videoRef1} autoPlay muted playsInline className="opacity-100 absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms]">
                        <source src="/videos/9153815-sd_960_506_30fps.mp4" type="video/mp4" />
                    </video>
                    <video ref={videoRef2} muted playsInline className="opacity-0 absolute inset-0 w-full h-full object-cover transition-opacity duration-[1500ms]">
                        <source src="/videos/4319652-hd_1280_720_30fps.mp4" type="video/mp4" />
                    </video>
                </div>
                <div className="container ml-4 px-0 relative z-20">
                    <div className="max-w-[360px] glass-hero">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 mb-4">
                            <span className="flex h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Bioacústica Avançada</span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black leading-[1.1] text-white mb-3">
                            Traduza o zumbido.<br />
                            <span className="text-primary">Salve o enxame.</span>
                        </h1>
                        <p className="text-sm md:text-base text-slate-200 font-normal leading-relaxed mb-6">
                            Monitoramento bioacústico avançado impulsionado por IA para identificar precocemente pragas e estresse na colmeia através da análise de som em tempo real.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="flex items-center justify-center gap-2 bg-primary text-background-dark px-6 py-3 rounded-lg text-sm font-bold shadow-xl shadow-primary/30 hover:shadow-2xl hover:scale-[1.03] transition-all group"
                            >
                                Começar Diagnóstico
                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button className="flex items-center justify-center gap-2 bg-white/10 backdrop-blur border border-white/20 text-white px-6 py-3 rounded-lg text-sm font-bold hover:bg-white/20 transition-all shadow-sm">
                                Ver Demo
                            </button>
                        </div>
                        <div className="mt-4 flex items-center gap-6 border-t border-white/10 pt-4 w-fit">
                            <div className="flex -space-x-2">
                                {[1, 2, 3].map(i => (
                                    <img
                                        key={i}
                                        src={`https://i.pravatar.cc/150?u=${i}`}
                                        className="h-8 w-8 rounded-full border border-slate-800"
                                        alt="User"
                                    />
                                ))}
                            </div>
                            <p className="text-[10px] font-medium text-slate-300">
                                <span className="text-white font-bold">450+</span> protegidos
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mission Section */}
            <section className="py-24 bg-white honeycomb-pattern" id="missao">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-20">
                        <span className="text-primary-dark font-bold tracking-widest uppercase text-sm mb-4">A Nossa Missão</span>
                        <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">Protegendo o ecossistema através da tecnologia</h2>
                        <p className="text-lg text-slate-600 leading-relaxed">
                            O BeeHealth AI faz a ponte entre a natureza e os dados para garantir a sobrevivência das colmeias. Acreditamos que o monitoramento silencioso é o futuro da apicultura sustentável.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <MissionCard title="Sustentabilidade" description="Foco total no equilíbrio ambiental e na preservação da biodiversidade global." bg="https://images.unsplash.com/photo-1589650394332-9cb542a1293c?auto=format&fit=crop&q=80&w=800" />
                        <MissionCard title="Inovação" description="Tecnologia de ponta em bioacústica e redes neurais para apicultura de precisão." bg="https://images.unsplash.com/photo-1463930355325-05589e13e51f?auto=format&fit=crop&q=80&w=800" />
                        <MissionCard title="Preservação" description="Proteção ativa das espécies através da detecção precoce de anomalias." bg="https://images.unsplash.com/photo-1558231907-7ea9550e823f?auto=format&fit=crop&q=80&w=800" />
                    </div>
                </div>
            </section>

            {/* Technology Section */}
            <section className="py-24 bg-white honeycomb-pattern" id="tecnologia">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="relative">
                            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
                            <div className="relative bg-white p-4 rounded-3xl shadow-2xl border border-white/50 overflow-hidden aspect-video">
                                <video ref={techVideoRef} autoPlay loop muted playsInline className="rounded-2xl w-full h-full object-cover">
                                    <source src="/videos/18069472-hd_1280_720_24fps.mp4" type="video/mp4" />
                                </video>
                            </div>
                        </div>
                        <div>
                            <span className="text-primary-dark font-bold tracking-widest uppercase text-sm mb-4">Tecnologia</span>
                            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-8">Bioacústica Avançada & IA</h2>
                            <p className="text-lg text-slate-600 mb-10 leading-relaxed">
                                Nossa inteligência artificial analisa padrões sonoros complexos em micro-frequências para entender o estado emocional e biológico das suas abelhas em tempo real.
                            </p>
                            <div className="space-y-8">
                                <TechItem title="Análise Acústica" description="Captura de frequências sonoras ultra-precisas com microfones de grau laboratorial." />
                                <TechItem title="IA de Ponta" description="Reconhecimento instantâneo de padrões de estresse, enxameamento e doenças." />
                                <TechItem title="Alertas em Tempo Real" description="Notificações preditivas enviadas diretamente para o seu dispositivo móvel." />
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

const MissionCard: React.FC<{ title: string; description: string; bg: string }> = ({ title, description, bg }) => (
    <div className="mission-card h-[400px] rounded-3xl transition-all group cursor-pointer relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: `url(${bg})` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/20" />
        <div className="relative h-full flex flex-col justify-end p-10 text-white z-10">
            <h3 className="text-xl font-bold mb-4">{title}</h3>
            <p className="text-slate-200 leading-relaxed font-medium">{description}</p>
        </div>
    </div>
);

const TechItem: React.FC<{ title: string; description: string }> = ({ title, description }) => (
    <div className="flex gap-6">
        <div className="shrink-0 w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-primary-dark">
            <Play className="w-6 h-6 fill-current" />
        </div>
        <div>
            <h4 className="text-lg font-bold mb-1">{title}</h4>
            <p className="text-slate-500">{description}</p>
        </div>
    </div>
);

export default Home;
