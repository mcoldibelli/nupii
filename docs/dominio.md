# Diagrama de domínio

Os conceitos do Nupii e as relações entre eles, escritos a partir do sistema pronto ([roteiro](roteiro.md), fatia 11). Os nomes seguem o app e os requisitos; entre parênteses, a tabela do [modelo de dados](modelo-de-dados.md).

```mermaid
classDiagram
  direction LR

  class Tutor {
    nome
    e-mail
    aceite dos termos
  }
  class Pet {
    nome, espécie, raça
    sexo, porte, nascimento
    peso, castrado
    veterinário
    foto
  }
  class Focinho {
    foto
    vetor de 512 valores
    versão do modelo
    qualidade
    principal
  }
  class Identificacao["Identificação"] {
    foto
    ponto
    contato de quem achou
  }
  class Candidato {
    posição 1 a 3
    semelhança
    confirmado em
  }
  class Ocorrencia["Ocorrência"] {
    tipo: perdido ou achado
    estado: aberta ou resolvida
    ponto, lugar, descrição
    foto
  }
  class Avistamento {
    ponto, lugar, descrição
  }
  class Notificacao["Notificação"] {
    título, texto
    distância
    estado do push
    lida em
  }
  class Dispositivo {
    token de push
    plataforma
  }
  class LocalTutor["Local do tutor"] {
    ponto
  }
  class EventoSaude["Evento de saúde"] {
    tipo: vacina, consulta, medicação, exame, anotação
    data
    próxima data
    lembrar
  }
  class Anexo {
    arquivo
    tipo do conteúdo
  }
  class LinkCarteirinha["Link da carteirinha"] {
    validade
    aberturas
    com exames
    revogado em
  }

  Tutor "1" --> "0..*" Pet : cuida
  Tutor "1" --> "0..1" LocalTutor : informa
  Tutor "1" --> "0..*" Dispositivo : registra
  Tutor "1" --> "0..*" Notificacao : recebe
  Tutor "0..1" --> "0..*" Ocorrencia : registra
  Pet "1" --> "0..*" Focinho : tem
  Pet "1" --> "0..*" EventoSaude : tem
  Pet "1" --> "0..*" LinkCarteirinha : compartilha
  Pet "0..1" --> "0..*" Ocorrencia : some em
  EventoSaude "1" --> "0..*" Anexo : tem
  Identificacao "1" --> "0..3" Candidato : sugere
  Candidato "0..*" --> "1" Focinho : compara com
  Candidato "0..*" --> "1" Pet : aponta para
  Ocorrencia "1" --> "0..*" Avistamento : recebe
  Ocorrencia "0..1" <-- "0..*" Notificacao : avisa sobre
```

## Regras que o diagrama não mostra

- Um pet tem no máximo um focinho principal (RN-09) e no máximo um desaparecimento aberto (RN-68). Os dois são índices únicos do [modelo de dados](modelo-de-dados.md).
- Uma identificação é anônima: ela não tem tutor. O contato de quem achou fica nela até a limpeza (RN-42).
- Um achado pode não ter tutor: quem registra sem conta resolve pelo código (RF-19, RF-21).
- Dois vetores só são comparados com a mesma versão do modelo (RF-15).
- Um tutor excluído continua no banco, anonimizado e marcado (`deleted_at`). Os dados dele são apagados ou anonimizados na exclusão (RF-08, [ADR 0028](adr/0028-exclusao-da-conta-e-limpeza.md)).
- A fila de jobs (`jobs`) é infraestrutura: ela leva os alertas, a exclusão no Firebase, a remoção de arquivos e a limpeza. Ela não é um conceito do domínio.
