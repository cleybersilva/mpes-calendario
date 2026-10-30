<div align="center">

# 📅 mpes-calendario

### Calendário vivo das aulas do Mestrado Profissional em Engenharia de Software da CESAR School (turma MPES 2026.2), editável no navegador e publicado no GitHub Pages

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-online-222222?logo=github&logoColor=white)](https://cleybersilva.github.io/mpes-calendario/)
[![HTML5](https://img.shields.io/badge/HTML5-PWA-E34F26?logo=html5&logoColor=white)](index.html)
[![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=black)](js/app.js)
[![CSS](https://img.shields.io/badge/CSS-responsivo_%2B_dark_mode-1572B6?logo=css3&logoColor=white)](css/styles.css)
[![CESAR School](https://img.shields.io/badge/CESAR_School-MPES_2026.2-FF6200)](https://www.cesar.school)

[![Itens](https://img.shields.io/badge/itens-40-blue.svg)](data.json)
[![CRUD](https://img.shields.io/badge/CRUD-completo-brightgreen.svg)](#️-uso)
[![Zero dependências](https://img.shields.io/badge/depend%C3%AAncias-zero_build%2C_zero_framework-brightgreen.svg)](#-arquitetura)
[![Agenda](https://img.shields.io/badge/exporta-.ics_%C2%B7_JSON-a3e635.svg)](#️-uso)
[![Token](https://img.shields.io/badge/token-s%C3%B3_no_navegador-yellow.svg)](#-segurança)

[🌐 Página ao vivo](https://cleybersilva.github.io/mpes-calendario/) •
[Sobre](#-sobre-o-projeto) •
[Arquitetura](#-arquitetura) •
[Funcionalidades](#-funcionalidades) •
[Instalação](#-instalação) •
[Uso](#️-uso) •
[Sincronização](#-sincronização-com-o-github) •
[Por que sincronizar](#-por-que-sincronizar) •
[Segurança](#-segurança) •
[Calendário](#-calendário-2026-2027) •
[Autor](#-autor)

<a href="https://cleybersilva.github.io/mpes-calendario/"><img src="https://img.shields.io/badge/%F0%9F%93%85_Abrir_o_calend%C3%A1rio-cleybersilva.github.io%2Fmpes--calendario-FF6200?style=for-the-badge" alt="Abrir o calendário"></a>

**🌐 Página do calendário: <https://cleybersilva.github.io/mpes-calendario/>**

---

</div>

## 📖 Sobre o Projeto

**mpes-calendario** é uma página estática que transforma o PDF do calendário
do **MPES 2026.2 (CESAR School)** num painel vivo: dá para adicionar, editar,
duplicar, marcar como concluído e excluir encontros direto no navegador, ver
o próximo encontro com contagem regressiva e acompanhar o progresso do curso
até a defesa da dissertação. São arquivos estáticos (HTML, CSS, JavaScript e um
`data.json`): sem build, sem framework, sem backend.

### 🧩 O problema que isto resolve

O calendário oficial chega em PDF, marcado como "em construção", e muda ao
longo do semestre: professor a definir, data remanejada, eletiva confirmada
depois. Um PDF não deixa anotar leituras, marcar o que já passou nem ver
rapidamente quantas sextas de aula ainda vêm pela frente. Para quem trabalha
em horário comercial e precisa negociar a saída nas sextas, isso conta. Esta
página resolve as duas coisas: mantém o calendário editável e mostra o que
importa para o planejamento, no celular ou no computador.

[![Painel no desktop](docs/screenshot-desktop.png)](https://cleybersilva.github.io/mpes-calendario/)

> 👉 **Acesse a página ao vivo:** [cleybersilva.github.io/mpes-calendario](https://cleybersilva.github.io/mpes-calendario/), no computador ou no celular. No celular, use o menu ⋮ › *Instalar como app* para ter o calendário na tela inicial.

## 🏗️ Arquitetura

```mermaid
flowchart LR
    subgraph REPO["Repositório GitHub · main"]
        H["index.html · css/ · js/<br/>UI + lógica (vanilla JS)"]
        D["data.json<br/>versão publicada do calendário"]
        A["assets/<br/>logos CESAR School"]
    end

    subgraph PAGES["GitHub Pages"]
        P["cleybersilva.github.io/mpes-calendario"]
    end

    subgraph NAV["Navegador"]
        UI["Painel<br/>Linha do tempo · Calendário · Tabela"]
        LS["localStorage<br/>edições locais + config"]
    end

    API["GitHub Contents API<br/>PUT data.json"]

    REPO -->|deploy automático| PAGES
    P -->|carrega| UI
    UI <-->|salva na hora| LS
    UI -->|Publicar alterações<br/>token fine-grained| API
    API -->|novo commit| D
```

1. **Carga**: a página busca o `data.json` publicado e compara com a cópia
   do `localStorage` pelo campo `meta.updatedAt`. Vence a mais recente.
2. **Edição**: toda alteração grava na hora no `localStorage`. O selo no
   topo indica **"Alterações não publicadas"** enquanto a versão local
   diferir da publicada.
3. **Publicação**: pelo menu **⋮ › Publicar alterações no GitHub**, a página
   faz um `PUT` na Contents API e grava o `data.json` como um novo commit.
   O GitHub Pages reconstrói o site em 1 a 2 minutos.

| Arquivo | Papel |
| --- | --- |
| `index.html` | Marcação da interface |
| `css/styles.css` | Estilos: tema claro/escuro, layout responsivo, bottom sheets e barra inferior no celular |
| `js/app.js` | Lógica: CRUD, validação dos dados, filtros, calendário, exportação `.ics`, sincronização com GitHub |
| `sw.js` · `manifest.webmanifest` | PWA: funciona offline e pode ser instalado na tela inicial |
| `data.json` | Fonte publicada dos itens (`meta` + `items`) |
| `assets/logo-cesar.png` | Logo e favicon |
| `docs/` | Capturas usadas neste README |
| `.nojekyll` | Serve os arquivos como estão, sem processamento Jekyll |

## ✨ Funcionalidades

| Recurso | Detalhe |
| --- | --- |
| CRUD completo | Adicionar, editar, duplicar, concluir e excluir, com **desfazer** |
| Três visualizações | Linha do tempo por mês, calendário mensal e tabela ordenável |
| Busca e filtros | Por texto, tipo, semestre e professor; opção de ocultar realizados |
| Próximo encontro | Cartão com data, turnos e contagem regressiva |
| Indicadores | Progresso do curso, encontros restantes, sextas com aula e prazo da defesa |
| Agenda | Exporta `.ics` com cada turno como evento (fuso America/Recife) |
| Backup | Baixa e importa o calendário em JSON |
| Tema | Claro e escuro, seguindo o sistema ou escolhido manualmente |
| Mobile | Barra de navegação inferior, formulários e detalhes em *bottom sheet* (arrastar para baixo fecha), filtros em painel, botão "voltar" do celular fecha janelas, deslizar no calendário troca o mês |
| Agenda do dia | Toque num dia do calendário para ver os itens e adicionar um novo naquela data |
| Offline / app | Funciona sem internet com a última versão salva e pode ser instalado como app (PWA) |
| Robustez | Dados validados e normalizados ao carregar/importar, aviso antes de sobrescrever uma versão publicada por outro dispositivo, sincronização entre abas |
| Atalhos | `n` novo item · `/` buscar · `t` ir para hoje · `←` `→` trocar mês |

## 🚀 Instalação

Não há build. Para rodar localmente:

```bash
git clone https://github.com/cleybersilva/mpes-calendario.git
cd mpes-calendario
python3 -m http.server 8080
```

Abra **http://localhost:8080/**. Use um servidor local em vez de abrir o HTML
como arquivo, porque o `fetch('data.json')` não funciona via `file://`.

O deploy usa **Settings › Pages › Deploy from a branch › `main` / `(root)`**.
Cada push na `main` atualiza o site.

## ▶️ Uso

| Ação | Como |
| --- | --- |
| Novo item | Botão **Novo item**, botão **+** no celular, tecla `n` ou clique num dia do calendário |
| Ver detalhes | Clique no cartão, na linha da tabela ou no evento do calendário |
| Editar / excluir | Ícones ✏️ e 🗑️ no cartão, ou dentro do formulário |
| Concluir | Ícone ✓ (alterna entre "Concluído" e status automático pela data) |
| Exportar agenda | **⋮ › Exportar para agenda (.ics)** e importar no Google Calendar ou Outlook |
| Backup | **⋮ › Baixar backup (JSON)** / **Importar backup (JSON)** |
| Voltar ao publicado | **⋮ › Descartar alterações locais** |

Cada item segue este formato no `data.json`:

```json
{
  "id": "i002",
  "titulo": "Gestão — Básico",
  "modulo": "Construção de Software I",
  "categoria": "gestao",
  "inicio": "2026-10-23",
  "fim": "2026-10-24",
  "horarios": ["sex2", "sab1", "sab2"],
  "professor": "Allan Araujo",
  "modalidade": "presencial",
  "semestre": 1,
  "local": "CESAR School",
  "notas": "",
  "status": "auto"
}
```

**Categorias:** `inaugural`, `gestao`, `requisitos`, `arquitetura`,
`interoperabilidade`, `metodologia`, `eletiva`, `acompanhamento`,
`avaliacao`, `orientacao`, `marco`, `outro`.

**Turnos (`horarios`):** `qua` (Qua 19h–21h), `sex1` (Sex 14h–17h), `sex2`
(Sex 18h–21h), `sab1` (Sáb 08h–12h), `sab2` (Sáb 13h–18h).

**Horário avulso (`horaIni`, `horaFim`):** para encontros fora dos turnos,
como orientações (ex.: `"horaIni": "20:00"`). O fim é opcional; sem ele, a
exportação para a agenda usa 1 hora de duração.

## 🔄 Sincronização com o GitHub

As edições ficam no navegador onde foram feitas. Para que apareçam em
qualquer dispositivo:

1. No GitHub: **Settings › Developer settings › Personal access tokens ›
   Fine-grained tokens › Generate new token**.
2. Em *Repository access*, escolha **Only select repositories ›
   `mpes-calendario`**.
3. Em *Permissions*, defina **Contents: Read and write**. Nenhuma outra
   permissão é necessária.
4. Na página: **⋮ › Configurar sincronização GitHub**, cole o token
   (usuário e repositório já vêm preenchidos) e salve.
5. Depois de editar: **⋮ › Publicar alterações no GitHub**.

### 💡 Por que sincronizar

Sem publicar, cada edição fica presa ao navegador onde foi feita. Ao
publicar, ela vira a versão oficial, que qualquer dispositivo enxerga.

| Benefício | O que muda na prática |
| --- | --- |
| 📱 **Mesmo calendário em todo lugar** | Marcou uma aula como concluída no notebook? O celular, o computador do trabalho ou outro navegador já abrem com a mudança, sem cópias divergentes |
| 🛟 **Edições não se perdem** | Limpar o histórico, usar aba anônima ou trocar de computador não apaga nada: cada publicação vira um commit guardado no GitHub |
| 🕓 **Histórico de todas as mudanças** | O GitHub registra cada versão do `data.json` com data e hora; um encontro apagado por engano pode ser recuperado a qualquer momento |
| 👥 **Compartilhável com a turma** | Quem abrir o link vê o calendário atualizado (professor confirmado, data remanejada, eletiva definida). Só quem tem o token altera; os demais apenas leem |
| 🛡️ **Proteção contra sobrescrever** | Se a versão publicada mudou em outro aparelho desde que a página foi aberta, ela avisa antes de substituir |

**Fluxo do dia a dia:** edite à vontade; quando o selo mostrar
**"Alterações não publicadas"**, toque nele para publicar. Em 1 a 2 minutos
o site está atualizado para todos.

**Validade do token:** o token expira no prazo escolhido (sugestão: 90
dias). Quando vencer, a publicação avisa que o token é inválido; basta
gerar outro e colar no mesmo lugar. O token fica salvo só no navegador onde
foi colado, então repita a configuração em cada aparelho de onde quiser
publicar.

## 🔒 Segurança

O token fica **somente no `localStorage` do navegador** em que foi
configurado: nunca entra no repositório nem em URL, e só é enviado para
`api.github.com`. Use um token **fine-grained, restrito a este repositório e
com prazo de expiração**. O botão **Esquecer token** apaga o token do
navegador. Todo texto exibido passa por escape de HTML, então nada digitado
num item é executado como código. Como o repositório é público (requisito do
GitHub Pages gratuito), **não registre dados sensíveis** nas anotações.

## 🗓️ Calendário 2026-2027

Fonte: *Calendário MPES 2026.2 (em construção)*, atualizado em 21/10/2026.

| Período | Módulo | Professor(a) |
| --- | --- | --- |
| 23/10/2026 | Aula inaugural | — |
| 23–24/10/2026 | Construção de Software I · Gestão (Básico) | Allan Araujo |
| 06–07/11/2026 | Construção de Software I · Requisitos (Básico) | Rodrigo Medeiros |
| 13–14/11/2026 | Construção de Software I · Arquitetura (Básico) | Walter Seiffert (online) |
| 27–28/11/2026 | Construção de Software I · Interoperabilidade (Básico) | Fernando Carvalho |
| 11–12/12/2026 | Construção de Software II · Gestão (Intermediário) | Suzanna Sandes |
| 18–19/12/2026 | Construção de Software II · Requisitos (Intermediário) | Allan Araujo |
| 08–09/01/2027 | Construção de Software II · Arquitetura (Intermediário) | Carlos Diego |
| 22–23/01/2027 | Construção de Software II · Interoperabilidade (Intermediário) | A definir |
| 19–20/02/2027 | Construção de Software III · Gestão (Avançado) | Suzanna Sandes |
| 26–27/02/2027 | Construção de Software III · Requisitos (Avançado) | Aêda Sousa |
| 12–13/03/2027 | Construção de Software III · Interoperabilidade (Avançado) | Milton Lima |
| 02–03/04/2027 | Construção de Software III · Arquitetura (Avançado) | Carlos Diego |
| 21–22/05/2027 | Metodologia · Parte 1 | Gustavo (online) |
| 04–05/06/2027 | Eletivas · Parte 1 | — |
| 18–19/06/2027 | Metodologia · Parte 2 | Danilo |
| 09–10/07/2027 | Eletivas · Parte 2 | — |
| 30–31/07/2027 | Metodologia · Parte 3 | Danilo |
| 13–14/08/2027 | Metodologia · Parte 4 | Gustavo (online) |
| 27–28/08/2027 | Eletivas · Parte 3 | — |
| 17–18/09/2027 | Eletivas · Parte 4 | — |

**Quartas (19h–21h):** acompanhamento dos projetos com Washington Almeida e
avaliações de projetos SR1 (17/02/2027), SR2 (19/05/2027) e SR3 (29/07/2027).

**Orientação:** projeto de pesquisa *"Um Agente de Inteligência Artificial
para Apoio à Escrita de Trabalhos Acadêmicos de Conclusão de Curso,
Dissertações e Teses em Engenharia de Software"*, com o Prof. Dr. Rafael
Batista Duarte, primeiro encontro na terça, 03/11/2026, às 20h.

**Dissertação:** acompanhamento I de set/2027 a mar/2028, qualificação até
30/03/2028, acompanhamento II de abr/2028 a set/2028 e **defesa até
30/09/2028** (tempo regular).

## 📘 Glossário

| Termo | Significado |
| --- | --- |
| MPES | Mestrado Profissional em Engenharia de Software (CESAR School) |
| Encontro | Bloco de aulas de um módulo, normalmente sexta à tarde/noite e sábado o dia todo |
| SR | Sessão de avaliação de projetos (SR1, SR2, SR3) |
| Marco | Etapa da dissertação com prazo (qualificação, defesa) |
| Publicado | Versão do `data.json` que está no repositório e no site |
| Local | Edições salvas só no navegador, ainda não publicadas |

## 🗺️ Roadmap

- Atualizar os dados a cada nova versão do PDF da coordenação.
- Registrar as eletivas escolhidas e seus professores quando forem definidos.
- Incluir salas e links das aulas online à medida que forem divulgados.

---

## 👤 Autor

<div align="center">

<img src="https://github.com/cleybersilva.png" width="120" style="border-radius:50%" alt="Cleyber Silva"/>

### **Cleyber Gomes da Silva**

**Senior Site Reliability Engineer & AI Specialist** · TCS × Itaú Unibanco (TAG)
**Platform Engineering** · Veni Creator Christian University (VCCU)
**Mestrando em Engenharia de Software** · CESAR School · **MBA em IA e Big Data** · ICMC / USP

📍 João Pessoa, Paraíba, Brasil

[![GitHub](https://img.shields.io/badge/GitHub-cleybersilva-181717?logo=github)](https://github.com/cleybersilva)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-cleybersilva-0A66C2?logo=linkedin)](https://www.linkedin.com/in/cleybersilva/)
[![EduAutismo IA](https://img.shields.io/badge/EduAutismo_IA-eduautismo.org-6C5CE7)](https://eduautismo.org/)

</div>

### Sobre o autor

Engenheiro com mais de 15 anos em tecnologia, que saiu do desenvolvimento
desktop e web para DevOps, DevSecOps e, hoje, **Site Reliability Engineering
com Inteligência Artificial** em ambientes bancários regulados. Desde
**março de 2023** está na **TCS (Tata Consultancy Services)**, atualmente
como **Senior SRE & AI Specialist na TAG do Itaú Unibanco**, apoiando várias
squads e Release Trains com foco em confiabilidade e observabilidade de
sistemas críticos.

No Itaú, arquitetou a união entre **SRE, Infraestrutura como Código
(Terraform) e IA generativa**: agentes com **RAG** integrados à **AWS** e ao
**Datadog** num modelo de **Observabilidade como Código**, que reduz a fadiga
de alertas, valida infraestrutura de forma autônoma e gera post-mortems
(RCAs) dentro das diretrizes de governança do banco. Também conduz war rooms
de incidentes orientadas a Golden Signals, SLOs e Error Budgets e cuida da
robustez dos pipelines de CI/CD.

Em paralelo, atua em **Platform Engineering na VCCU** (Orlando, EUA) desde
2021, mantendo sistemas internos, o VLE em Moodle e serviços web. Na
pesquisa, concluiu em outubro de 2026 o **MBA em IA e Big Data do ICMC/USP**
com o **[EduAutismo IA](https://eduautismo.org/)**, sistema que usa IA para
apoiar professores na adaptação de atividades para alunos com TEA, já em
produção e com código aberto. No **Mestrado Profissional da CESAR School**,
pesquisa engenharia de software suportada por IA, observabilidade de
sistemas com LLMs e IA confiável.

**Trajetória profissional:**

| Período | Função | Organização |
| --- | --- | --- |
| mar/2023 – atual | Senior Site Reliability Engineer & AI Specialist | TCS · Itaú Unibanco (TAG) |
| mar/2023 – nov/2023 | Senior DevSecOps Engineer | TCS · Bradesco Seguros |
| jan/2021 – atual | Platform Engineering | Veni Creator Christian University |
| abr/2018 – jan/2023 | DevOps Engineer | UNICORP Faculdades |
| jan/2017 – set/2022 | Desenvolvedor Full Stack (freelance) | The Solution Consultoria |
| jan/2010 – jan/2016 | Desenvolvedor Desktop e Front-End | Franquia Microcamp |

**Formação:**
- 🎓 Mestrado Profissional em Engenharia de Software — CESAR School (2026–2028, em andamento)
- 🎓 MBA em Inteligência Artificial e Big Data — ICMC/USP (2025–2026)
- 🎓 Doutorado em Ciências da Educação — VCCU (em andamento)
- 🎓 Mestrado em Ciências da Educação, Information Technology — VCCU (2022–2023)
- 🎓 Especialização em Site Reliability Engineering — PUC Minas (2024–2025)
- 🎓 Pós-graduação em Arquitetura de Sistemas .NET com Azure — FIAP (2023–2024)
- 🎓 Pós-graduação em Engenharia DevOps — Unyleya (2022–2023)
- 🎓 MBA em Gestão de Pessoas e Coaching — UNICORP (2019–2020)
- 🎓 Tecnólogo em Análise e Desenvolvimento de Sistemas — Estácio (2020–2022)
- 🎓 Bacharelado em Administração — Estácio (2010–2014)

**Competências:** IA generativa (LLMs, RAG, agentes) · AIOps · Observabilidade
como Código · Datadog · Terraform · Kubernetes (AKS/EKS) · GitOps · AWS ·
Azure · CI/CD · DevSecOps · .NET · Python.

**Certificações em destaque:** EXIN Artificial Intelligence Foundation ·
Terraform Essentials (LINUXtips) · Automatizando DevSecOps (FIAP).

---

<div align="center">

### ⭐ Se este projeto foi útil, considere dar uma estrela!

**Feito com ❤️ para não perder nenhuma sexta de aula no CESAR**

---

**mpes-calendario** · Calendário vivo · CESAR School · MPES 2026.2

[⬆ Voltar ao topo](#-mpes-calendario)

---

_"O PDF diz quando; o painel lembra o que fazer com cada data."_

© 2026 · Cleyber Gomes da Silva

</div>
