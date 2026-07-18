# Colmeia Saudável — Modelo de Negócio (versão concreta)

> Documento de apoio. Valores assinalados como *estimativa* são indicativos para o plano de negócio.

---

## 1. Modelo de Negócio — resumo concreto

A Colmeia Saudável é um **SaaS freemium** desenhado para o apicultor angolano. O pequeno produtor usa gratuitamente o diagnóstico por IA no telemóvel; cooperativas e grandes produtores pagam licença multi-colmeia. A margem é alta porque **não vendemos hardware** — o sensor é o próprio telemóvel do utilizador e a IA corre na nuvem (Groq).

**Fluxo de valor:** apicultor grava som/imagem → plataforma analisa (rainha, Varroa, stress, enxameio, temperatura) → devolve diagnóstico e ação sugerida → colmeia sobrevive → mais polinização → mais produção agrícola e de mel.

---

## 2. Business Model Canvas (específico)

| Bloco | Conteúdo específico |
|-------|--------------------|
| **Parcerias Chave** | • **Apicultores e cooperativas** de Huíla, Benguela, Huambo e Bié (principais zonas apícolas de Angola).<br>• **Universidade Agostinho Neto (UAN)** e **Universidade Técnica de Angola (UTA)** — validação científica e dados.<br>• **MONAP / Ministério da Agricultura e Pescas** e **INAPA** — extensão rural e sustentabilidade.<br>• **Groq** — inferência de IA (áudio, visão, chat).<br>• **Unitel / Africell** — pacotes de dados para zonas rurais.<br>• **ONGO** (ex.: ADIRA, HELVETAS) — financiamento de biodiversidade. |
| **Atividades Chave** | • Desenvolvimento web (React/Vite) e backend Node/Express.<br>• Afinação dos prompts de IA para contexto angolano (frequências: rainha "tooting" 350–500 Hz; "queenless" 478–1080 Hz; atividade 100–260 Hz).<br>• Curadoria da base de 21 províncias (clima Open-Meteo) para a saúde térmica.<br>• Formação presencial em feiras e cooperativas. |
| **Recursos Chave** | • Equipa: 1 dev full-stack + 1 consultor apícola + 1 marketing.<br>• API Groq (LLaMA 4 / Whisper).<br>• Servidor Render (hospedagem) + domínio `.ao`/`.co.ao`.<br>• Comunidade de apicultores (o telemóvel deles é o sensor). |
| **Proposta de Valor** | • **Não invasivo:** não abre a colmeia — usa som + imagem do telemóvel.<br>• **Deteção precoce** de Varroa, rainha ausente, stress e enxameio.<br>• **Saúde térmica local:** cruza temperatura interna com clima real de cada uma das 21 províncias.<br>• **Acessível:** 0 Kz para o pequeno apicultor; funciona em browser de telemóvel. |
| **Relação com Cliente** | • Self-service na web/app.<br>• Chat com IA ("Tirar dúvida com IA").<br>• Grupo WhatsApp/Comunidade por cooperativa.<br>• Newsletters com épocas de manejo (ex.: pré-enxameio em setembro). |
| **Canais** | • Plataforma web (painel principal + dashboard).<br>• TikTok/YouTube Shorts ("como saber se a rainha está lá").<br>• **Feira Nacional de Apicultura**, FILDA, feiras agrícolas provinciais.<br>• Parceiros cooperativos que já têm capacidade de extensão rural. |
| **Segmentos de Cliente** | 1. **Pequenos apicultores familiares** (gratuito — aquisição).<br>2. **Cooperativas apícolas** (licença B2B).<br>3. **Grandes produtores / farms** que dependem de polinização (citrinos, café, maconha? não — milho, fruta).<br>4. **ONG / governos locais** (programas de biodiversidade). |
| **Estrutura de Custos** | • **Hospedagem Render**: free tier → ~$0; se escala, Starter $7/mês.<br>• **API Groq**: pay-per-token; *estimativa* $5–20/mês nos primeiros 6 meses.<br>• **Domínio .ao**: ~50.000 Kz/ano.<br>• **Pessoal**: 3 pessoas (parte do tempo no arranque).<br>• **Marketing/eventos**: ~100.000 Kz/ano (feiras, material). |
| **Fontes de Receita** | 1. **Premium** (pessoa): *estimativa* **2.500 Kz/mês** ou **25.000 Kz/ano** (histórico ilimitado, relatórios, dashboard).<br>2. **Licença cooperativa**: *estimativa* **150.000 Kz/ano** até 50 colmeias.<br>3. **Marketplace de mel**: comissão **8%** por venda intermédiada.<br>4. **Consultoria**: **25.000–50.000 Kz** por visita técnica.<br>5. **Dados anonimizados** para UAN/ONG (projeto/patrocínio). |

---

## 3. Exemplo de unit economics (estimativa)

- **Custo por utilizador ativo/mês**: ~50 Kz (IA + servidor repartido).
- **Preço Premium**: 2.500 Kz/mês → margem bruta ~98%.
- **Ponto de equilíbrio**: ~60 subscritores Premium ou 2 licenças cooperativas.

## 4. Diferenciais face à concorrência

- **Modelo "sensor = telemóvel"**: sem hardware proprietário (ao contrário de sensores IoT caros).
- **Foco Angola**: clima das 21 províncias e contexto apícola local.
- **Bioacústica + IA conversacional**: explica ao apicultor, não só mede.
- **Freemium**: entra sem cartão, converte pela utilidade.

## 5. Plano de crescimento

1. **Mês 0–6:** gratuito para apicultores; construir base de utilizadores via cooperativas.
2. **Mês 6–12:** lançar Premium e licenças cooperativas; marketplace piloto.
3. **Ano 2:** parceria com MONAP para programa nacional de saúde apícola; dados agregados para investigação.
