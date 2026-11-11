# Roteiro

A construção segue fatias verticais. Uma fatia vai do banco até a tela e termina com o sistema em execução.

## Regras de toda fatia

1. Antes de começar: analisar os requisitos da fatia em [requisitos.md](requisitos.md), fechar os itens em rascunho e responder as perguntas da seção "Em aberto".
2. Ordem do trabalho: contrato OpenAPI, migration, regra de domínio com teste, handler, tela.
3. Pronto significa: os testes foram executados e passaram, o fluxo foi executado de ponta a ponta e a documentação foi atualizada.
4. Uma fatia não começa antes de a anterior estar pronta.
5. Cada tarefa da fatia é uma issue no GitHub, criada antes de o trabalho começar. O trabalho da issue acontece em um branch próprio, que entra em `develop` por PR.
6. No fim da fatia, quando o milestone dela fecha, um PR leva `develop` para `main`.

## Fatias

| # | Fatia | Entrega | Critério de pronto |
|---|---|---|---|
| 0 | Fundação | Repositório, ADR das ferramentas de teste, CI, lint, compose (Postgres com PostGIS e pgvector, servidor S3), migrations, `GET /v1/health`, app Expo que chama o health | `docker compose up` sobe tudo. O CI passa. O app mostra a resposta do health. |
| 1 | Identidade | Criar conta e entrar pelo Firebase Authentication no app. A API valida o ID token e cria o tutor com o aceite dos termos. | Uma conta nova entra no app, fecha o app, abre de novo e continua logada. Uma chamada sem token, ou com token inválido, recebe 401. |
| 2 | Pets | CRUD do pet e foto de perfil. Telas de lista, criar e editar. | Um pet com foto aparece na lista depois de reiniciar o app. |
| 3 | Inferência | Serviço de inferência em Python, sem torch. Os arquivos de pesos ficam em uma release do GitHub deste repositório, com uma tag por versão do modelo, e um script baixa os arquivos e confere o SHA-256. Teste de igualdade contra os vetores de referência, com fotos reais de focinho. | Para um conjunto fixo de fotos, o vetor do serviço é igual ao vetor de referência, dentro da tolerância definida no [ADR 0007](adr/0007-inferencia-python-onnx.md). |
| 4 | Biometria | Cadastro do focinho, identificação, confirmação com contato, avisos de encontro. Web pública "encontrei um pet". | Um focinho cadastrado no app é encontrado pela web pública com outra foto do mesmo cão. |
| 5 | Ocorrências | Perdido, achado, avistamento, resolver, mural e ficha. No app e na web pública. | Um desaparecimento registrado no app aparece no mural da web. Um avistamento feito na web aparece na ficha. |
| 6 | Alertas | Fila de tarefas, última localização, dispositivos, alerta de proximidade, push, lista de notificações. | Um tutor a menos de 3.000 m recebe a notificação. Com a API parada logo depois do registro, a notificação sai na subida seguinte. |
| 7 | Saúde | Eventos de saúde, anexos, lembretes. | Os cinco tipos de evento são criados, editados e apagados no app. |
| 8 | Carteirinha | Link compartilhado, QR code e a página pública da carteirinha. | Um link aberto na web mostra a carteirinha. Depois de revogado, o mesmo link devolve 404. |
| 9 | Conta e LGPD | Perfil, telas de trocar senha e esqueci a senha (pelo Firebase), excluir conta com anonimização, limpeza diária dos dados vencidos. | Uma conta excluída some da identificação e do mural, e o usuário dela não existe mais no Firebase. A tarefa de limpeza apaga um registro com data forçada para 31 dias atrás. |
| 10 | Publicação | Login com Google, build do app, publicação da API e da web. | O app instalado em um aparelho real usa a API publicada. |
| 11 | Documentação final | Casos de uso, diagrama de domínio e modelo de dados (DER), escritos a partir do sistema pronto. | Cada caso de uso aponta para os RF que ele cobre. O DER tem as mesmas tabelas e relações das migrations. O README lista os três documentos. |

## Por que esta ordem

- As fatias 0 a 2 criam a base que todas as outras usam.
- As fatias 3 e 4 vêm cedo porque a biometria é o maior risco técnico e o que diferencia o produto.
- A fila de tarefas entra na fatia 6, que é a primeira fatia que precisa dela.
- A saúde vem depois porque é a parte com menos risco: são cadastros.
- A fatia 11 vem por último porque a fonte dos três documentos é o sistema pronto: as migrations, o contrato da API e os requisitos fechados.

## Prova técnica antes da fatia 4

Pergunta: o detector YOLO11n roda no aparelho, dentro do app Expo, com velocidade para guiar a câmera?

- Como: um app de teste com a câmera, o runtime ONNX nativo e o arquivo `detector_focinho_yolo11n.onnx`.
- Medida: tempo por quadro em um aparelho Android intermediário.
- Se a resposta for não, ou se a prova passar de dois dias: a v1 não tem detector no aparelho. O app envia a foto e mostra o erro `image_framing` ou `image_low_quality` que o serviço de inferência devolve.

A versão sem detector no aparelho é o padrão da fatia 4. O detector no aparelho é uma melhoria de uso, não um requisito.

## Decisões que ficam para a fatia

| Decisão | Fatia |
|---|---|
| Forma da web pública: mesmo projeto Expo ou projeto web separado (critérios no [ADR 0006](adr/0006-mobile-expo-web-publica.md)) | 4 |
| Orçamento de JavaScript da web pública, em KB (critério do [ADR 0006](adr/0006-mobile-expo-web-publica.md)) | 4 |
| Biblioteca de push no app e de mapa no app | 5 e 6 |
| Modelagem dos eventos de saúde: uma tabela por tipo ou uma tabela com tipo e colunas opcionais | 7 |
| Onde o lembrete de vacina e de medicação é calculado: no app ou em uma tarefa do backend | 7 |
| Onde a API, a web e a inferência são publicadas | 10 |
