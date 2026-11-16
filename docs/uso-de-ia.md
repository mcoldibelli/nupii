# Uso de Inteligência Artificial no desenvolvimento

Este documento declara o uso de ferramentas de IA no desenvolvimento do Nupii, como pede a seção 4 do enunciado (Política de Uso de Inteligência Artificial). Ele trata da IA usada para **construir** o sistema. O serviço de IA que **faz parte** do produto (o reconhecimento do focinho) está descrito na [arquitetura](arquitetura.md) e nos ADRs [0007](adr/0007-inferencia-python-onnx.md) e [0036](adr/0036-vetor-do-recorte-do-focinho.md).

O grupo é responsável por todo o conteúdo entregue, também pelas partes feitas ou alteradas com a ajuda da IA.

## Ferramentas de IA utilizadas

| Ferramenta | Para quê |
|---|---|
| **Claude Code** (Anthropic), agente de programação no terminal | Ler o repositório, escrever código e testes, rodar comandos (testes, build, Docker, Git, GitHub CLI), abrir pull requests e publicar na VPS |
| Subagentes e um revisor do próprio Claude Code | Segunda opinião antes de decisões grandes (por exemplo, o desenho do recorte do focinho, a observabilidade) e revisão antes de declarar uma tarefa concluída |

O grupo usou só o Claude Code com o modelo Claude Opus 5.5.

## Modelos utilizados

- **Claude Opus 5.5** (Anthropic), em todo o projeto, como apoio para o desenvolvimento, a arquitetura, o fluxo de issues, os testes e a interface.

## Atividades em que a IA foi usada

- **Fluxo de trabalho:** uma issue para cada tarefa, uma branch por issue e um pull request para a `develop`.
- **Interface:** as telas do app e da web, seguindo o canvas de design.
- **Programação:** a API em Go, o app em React Native com Expo (app e web), o serviço de inferência em Python e os scripts de publicação.
- **Testes:** testes escritos antes do código (unidade, integração e contrato), e testes de ponta a ponta no navegador com capturas de tela.
- **Pesquisa e decisões:** comparação de alternativas registrada em ADRs (por exemplo, Prometheus contra Mimir, túnel SSH para o Grafana, CSP sem `'unsafe-eval'`), com medidas antes da decisão.
- **Depuração:** diagnóstico com dados reais, como as fotos de um cão real para entender por que o cadastro do focinho falhava.
- **Documentação:** README, requisitos, casos de uso, diagrama de domínio, modelo de dados e ADRs.
- **Operação:** publicação na VPS, configuração do Caddy, segurança do servidor e verificação em produção.

## Como o trabalho da IA foi conferido

- Cada mudança entrou por um pull request, com o CI (lint, testes, build, integração e verificação de segredos) obrigatório antes do merge.
- Uma regra do projeto: nenhuma afirmação sem prova. A IA mostra o comando que rodou e o resultado, e marca o que não conseguiu verificar.
- As mudanças visuais foram conferidas com capturas de tela; as de produção, com chamadas reais à API e ao site publicado.
- O responsável pelo produto aprovou cada passagem para a branch `main` e cada publicação.

## Principais dificuldades encontradas

- O teste em aparelho real: o app roda no Expo Go, e parte do comportamento (câmera, fotos HEIC do iPhone, localização) só aparece no aparelho. Vários defeitos foram achados só no teste do responsável pelo produto.
- A IA trabalha com o que consegue executar. Sem acesso ao aparelho, ao console do Firebase ou a uma conta Google real, ela precisou deixar esses passos explicados para uma pessoa.
- O contexto longo: em sessões extensas, a IA precisou de notas e de memória do projeto para não repetir erros e não perder decisões já tomadas.

## Erros e limitações identificados nas respostas da IA, e as correções

| O que a IA fez de errado | Como foi achado | Correção |
|---|---|---|
| Fez o merge de um PR com a verificação de segredos (GitGuardian) falhando: o comando de merge não esperava o resultado de todos os checks | O alerta do GitGuardian | O falso positivo foi corrigido (#266) e o merge passou a depender de todos os checks |
| Um script de merge da própria IA juntou o login com Google (#279) antes do teste manual com uma conta real | Revisão do resultado do comando | O script passou a só fazer merge com um pedido explícito; o estado real foi registrado na issue (#153) |
| O primeiro desenho do reconhecimento do focinho aceitava fotos de longe e recusava fotos só do focinho: o vetor saía da foto inteira | Teste do responsável pelo produto com a cadela dele (Shih Tzu) | Medida com dados reais e mudança do pipeline: o vetor sai do recorte do focinho (ADR 0036, #292) |
| A IA calculou o tamanho mínimo do recorte do rosto na web (600 px) por uma estimativa ("um terço"), que as medidas contradiziam | Revisão antes do PR, com as próprias medidas | Novo cálculo com os dados: 960 px (#296) |
| A galeria do iPhone mandava fotos HEIC ou JPEG acima de 8 MB, e o envio falhava | Teste no iPhone do responsável pelo produto | A galeria pede JPEG e a foto é reduzida antes do envio (#298) |
| A carteirinha impressa saía com a barra lateral, os botões e sem as cores: o teste inicial só simulou a impressão | Revisão, com a geração real do PDF | CSS de impressão (#280) |
| Com a CSP valendo, a conversão de fotos HEIC na web travava sem mensagem | Teste com a política valendo antes de publicar | O conversor saiu, e a página mostra uma mensagem clara (#305) |
| Um filtro do script de publicação recusava a web por falso alarme | Execução do script | Filtro corrigido (#269) |
| A IA afirmou num comentário onde o app pede a localização sem conferir no código | Conferência no código logo depois | Comentário de correção na issue (#169) |

Limitações gerais observadas: a IA pode tratar uma hipótese como fato, estimar onde deveria medir e assumir o padrão de uma ferramenta sem ler o código dela. As correções acima vieram da regra de provar cada afirmação e dos testes em condições reais.

## Correções e adaptações feitas pelo grupo

- O responsável pelo produto recusou propostas de tela e pediu ajustes de layout e de texto. Por exemplo, a faixa de pet desaparecido saiu do meio do início e foi para a folha de ações.
- Os testes com dados reais (o cão do responsável, o iPhone, o Firefox) acharam defeitos que os testes automatizados não pegavam, e direcionaram as correções.
- Decisões de produto e de segurança ficaram com o grupo: o que ficou fora da v1 (o app instalável e o push), o Grafana só por túnel SSH, a CSP sem `'unsafe-eval'` e a fonte Nunito.

## Avaliação de como a IA contribuiu

O Claude Opus 5.5 foi o apoio do grupo no desenvolvimento, na arquitetura, no fluxo de issues, nos testes e na interface. O grupo decidiu o escopo e o produto, conferiu cada entrega e testou em condições reais.

## Compreensão do código

Os integrantes do grupo entendem o código entregue e sabem explicá-lo, inclusive as partes feitas ou alteradas com a ajuda da IA.
