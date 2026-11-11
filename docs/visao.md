# Visão

Estado: rascunho, para revisão.

## O que é

O Nupii é uma plataforma para tutores de pets. Ela tem três partes: saúde do pet, mural de perdidos e achados, e identificação de cães pela foto do focinho.

## Problema

O Nupii responde a três necessidades de quem cuida de um pet:

1. Guardar o histórico de saúde do pet em um lugar só, e mostrar esse histórico a outra pessoa por um link.
2. Avisar as pessoas próximas quando um pet desaparece, e receber os avistamentos.
3. Descobrir quem é o tutor de um cão encontrado, a partir de uma foto do focinho.

## Usuários

| Usuário | Quem é | Como usa |
|---|---|---|
| Tutor | Pessoa com conta, responsável por um ou mais pets | App mobile (Android e iOS) |
| Visitante | Pessoa sem conta. Exemplo: quem encontra um cão na rua | Web pública, sem instalar nada |

## Escopo da v1

| Parte | O que o sistema faz | Requisitos |
|---|---|---|
| Conta | Criar conta, entrar, redefinir a senha, alterar o perfil, excluir a conta | RF-01 a RF-08 |
| Pets | Cadastro do pet e foto de perfil | RF-09, RF-10 |
| Biometria | Cadastro do focinho, identificação por foto, confirmação com contato, avisos de encontro | RF-11 a RF-15 |
| Ocorrências | Perdido, achado, avistamento, mural e ficha | RF-16 a RF-21 |
| Alertas | Alerta de proximidade, push e lista de notificações | RF-22 a RF-26 |
| Saúde | Vacinas, consultas, medicações, exames, anotações, anexos e lembretes | RF-27 a RF-29 |
| Carteirinha | Resumo de saúde do pet, compartilhado por link e QR code | RF-30, RF-31 |
| Privacidade | Limpeza diária dos dados com prazo vencido | RF-32 |

Os requisitos estão em [requisitos.md](requisitos.md).

## Fora do escopo da v1

| Item | Motivo |
|---|---|
| Biometria de outras espécies | O modelo identifica só cães (RN-07). |
| Treino, exportação e validação do modelo | O modelo chega pronto, como artefato externo ao repositório ([ADR 0007](adr/0007-inferencia-python-onnx.md)). |
| Endpoints de administração | Entram quando uma tarefa de administração se repete. |
| Login com Apple | Entra com a publicação na App Store. |
| Detector de focinho no aparelho | Depende da prova técnica do [roteiro](roteiro.md). |

Os itens de arquitetura que ficam fora da v1 estão em [arquitetura.md](arquitetura.md), seção "Fora da v1".

## Restrições

- O visitante usa os fluxos públicos sem conta e sem instalar nada (RNF-04).
- Os dados pessoais seguem a LGPD: retenção de 30 dias para contato de visitante, foto de consulta e localização (RN-42).
- O modelo e os limiares da identificação são fixos na v1 (RN-13, RN-15, RN-19).
