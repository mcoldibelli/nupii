# Requisitos

## Como ler este documento

- **RF**: requisito funcional. O que um usuário ou o sistema faz.
- **RN**: regra de negócio. Uma condição ou um valor que o sistema obedece.
- **RNF**: requisito não funcional.
- Um identificador não muda e não é usado de novo. Um item novo recebe o próximo número.
- **Estado `estável`**: o item pode ser implementado como está.
- **Estado `rascunho`**: o item ainda não passou pela análise detalhada da fatia dele. Ele pode mudar. A análise é o primeiro passo da fatia ([roteiro](roteiro.md), regra 1).
- A coluna "Fatia" aponta para a fatia do [roteiro](roteiro.md) que entrega o item.
- Os termos do domínio estão no glossário de [arquitetura.md](arquitetura.md).

## Requisitos funcionais

### Identidade e conta

| ID | Requisito | Fatia | Estado |
|---|---|---|---|
| RF-01 | O tutor cria uma conta com e-mail e senha. No primeiro acesso ele informa o nome e aceita os termos de uso. | 1 | estável |
| RF-02 | O tutor entra com e-mail e senha. A sessão continua depois de fechar o app. | 1 | estável |
| RF-03 | O tutor entra com a conta Google. | 10 | rascunho |
| RF-04 | O tutor sai da conta. | 1 | estável |
| RF-05 | O tutor redefine uma senha esquecida por um link que chega por e-mail. | 9 | estável |
| RF-06 | O tutor vê e altera o próprio perfil: o nome. O e-mail aparece, mas não muda ([ADR 0028](adr/0028-exclusao-da-conta-e-limpeza.md)). | 9 | estável |
| RF-07 | O tutor troca a senha. | 9 | estável |
| RF-08 | O tutor exclui a própria conta. O app pede a senha de novo antes. | 9 | estável |
| RF-33 | Na primeira abertura, o app mostra uma apresentação em quatro passos, com os caminhos para entrar, criar conta, achei um cachorro e o mural ([ADR 0030](adr/0030-visual-do-app.md)). | 9c | estável |

### Pets

| ID | Requisito | Fatia | Estado |
|---|---|---|---|
| RF-09 | O tutor cria, lista, vê, altera e exclui um pet. Dados do pet: nome, espécie, raça, sexo, porte, data de nascimento, peso, castrado, e o nome, a clínica e o telefone do veterinário. | 2 | estável |
| RF-10 | O tutor envia a foto de perfil do pet. | 2 | estável |

### Biometria do focinho

| ID | Requisito | Fatia | Estado |
|---|---|---|---|
| RF-11 | O tutor cadastra o focinho de um pet com uma foto. | 4 | estável |
| RF-12 | Qualquer pessoa, com ou sem conta, envia a foto de um focinho e recebe os pets candidatos. | 4 | estável |
| RF-13 | Quem encontrou o cão confirma um candidato e deixa nome, telefone e mensagem para o tutor. | 4 | estável |
| RF-14 | O tutor lista os avisos de encontro dos pets dele. | 4 | estável |
| RF-15 | O sistema calcula de novo os vetores gravados com outra versão do modelo, quando a versão do modelo muda. | 4 | estável |

### Ocorrências e mural

| ID | Requisito | Fatia | Estado |
|---|---|---|---|
| RF-16 | Qualquer pessoa vê o mural: a lista das ocorrências abertas dos tipos perdido e achado. | 5 | estável |
| RF-17 | Qualquer pessoa vê a ficha de uma ocorrência. | 5 | estável |
| RF-18 | O tutor registra o desaparecimento de um pet dele. | 5 | estável |
| RF-19 | Qualquer pessoa registra um achado. | 5 | estável |
| RF-20 | Qualquer pessoa registra um avistamento em uma ocorrência do tipo perdido. | 5 | estável |
| RF-21 | O autor de uma ocorrência marca a ocorrência como resolvida. | 5 | estável |

### Alertas

| ID | Requisito | Fatia | Estado |
|---|---|---|---|
| RF-22 | O app envia a localização do tutor para a API. | 6 | estável |
| RF-23 | O app registra e remove o dispositivo do tutor para receber push. A API tem as operações na fatia 6. O app usa as operações na fatia 10 ([ADR 0024](adr/0024-push-no-app.md)). | 6 e 10 | estável |
| RF-24 | Quando um desaparecimento é registrado, os tutores próximos recebem uma notificação. | 6 | estável |
| RF-25 | O tutor lista as notificações e marca uma notificação como lida. | 6 | estável |
| RF-26 | O sistema envia cada notificação também por push. | 6 | estável |

### Saúde

| ID | Requisito | Fatia | Estado |
|---|---|---|---|
| RF-27 | O tutor cria, lista, altera e apaga os eventos de saúde de um pet: vacina, consulta, medicação, exame e anotação. | 7 | estável |
| RF-28 | O tutor envia, lista e apaga os anexos de um evento de saúde. | 7 | estável |
| RF-29 | O tutor vê os próximos cuidados de vacina e de medicação dos pets dele. O lembrete por push entra na fatia 10 ([ADR 0026](adr/0026-eventos-de-saude.md)). | 7 e 10 | estável |
| RF-34 | O início mostra um pet por vez, escolhido num seletor: a foto, o próximo cuidado dele e o peso ao longo do tempo, a partir dos eventos de saúde com peso (RN-51). O seletor mostra se o focinho de cada cachorro está cadastrado. | 9c | estável |

### Carteirinha

| ID | Requisito | Fatia | Estado |
|---|---|---|---|
| RF-30 | O tutor cria um link público da carteirinha do pet, com QR code, e revoga o link ([ADR 0027](adr/0027-link-da-carteirinha.md)). | 8 | estável |
| RF-31 | Qualquer pessoa com o link vê a carteirinha. | 8 | estável |

### Privacidade

| ID | Requisito | Fatia | Estado |
|---|---|---|---|
| RF-32 | O sistema apaga todo dia os dados pessoais com prazo de retenção vencido. | 9 | estável |

## Regras de negócio

### Identidade e conta

| ID | Regra | RF | Estado |
|---|---|---|---|
| RN-01 | O sistema guarda a data e a versão dos termos de uso que o tutor aceitou. O tutor só é registrado com o aceite da versão vigente dos termos. O texto fica no app e na página pública `/terms`. | RF-01 | estável |
| RN-02 | Um e-mail identifica uma conta só. O provedor de identidade aplica a regra. Para o login com Google, ver a seção "Em aberto". | RF-01, RF-03 | estável |
| RN-03 | Excluir a conta anonimiza o tutor (nome "Conta excluída", e-mail sem dono, data da exclusão) e apaga o usuário no provedor de identidade. Um usuário que já não existe no provedor conta como apagado. | RF-08 | estável |
| RN-04 | Uma conta excluída recebe 401, mesmo com um token ainda válido, também no registro. Os pets dela saem da identificação e do mural. | RF-08 | estável |
| RN-84 | Excluir a conta exclui os pets (com a foto), apaga os cadastros biométricos (com as fotos) e os candidatos de identificação deles, os eventos de saúde (com os anexos), os links da carteirinha, as notificações, os dispositivos e a última localização. O pet fica com o nome "Pet excluído", sem raça, nascimento, peso e veterinário. Os desaparecimentos do tutor ficam resolvidos, sem a descrição e sem o nome do lugar. O ponto no mapa fica. Uma escrita que estava em andamento durante a exclusão é apagada 5 minutos depois. | RF-08 | estável |
| RN-44 | A senha tem no mínimo 8 caracteres. O app confere antes de enviar. | RF-01 | estável |
| RN-45 | O nome do tutor é obrigatório e tem no máximo 100 caracteres. | RF-01 | estável |
| RN-46 | Uma chamada sem token, com token inválido ou com token vencido recebe 401. | RF-02 | estável |
| RN-47 | A conta pode ser usada sem a confirmação do e-mail. | RF-01 | estável |

### Pets

| ID | Regra | RF | Estado |
|---|---|---|---|
| RN-05 | A exclusão de um pet é lógica: o registro fica no banco com a data da exclusão. A exclusão apaga a foto de perfil do armazenamento. | RF-09 | estável |
| RN-06 | A foto fica no armazenamento de objetos. A API devolve uma URL temporária, válida por 15 minutos. | RF-10 | estável |
| RN-48 | O nome e a espécie do pet são obrigatórios. A API aceita cachorro, gato ou outro; o app cadastra só cachorro, porque a inferência lê só o focinho de cachorro. A raça vem de uma lista de raças de cachorro, com a opção SRD (sem raça definida). | RF-09 | estável |
| RN-49 | O sexo é macho, fêmea ou indefinido. O porte é pequeno, médio ou grande. Os dois são opcionais. | RF-09 | estável |
| RN-50 | A data de nascimento é opcional, porque o tutor pode não saber. Quando informada, não é uma data futura. A data de hoje é a data em UTC. Sem a data, as telas não mostram a idade. | RF-09 | estável |
| RN-51 | O peso, quando informado, fica entre 0,01 kg e 999,99 kg, com no máximo 2 casas decimais. | RF-09 | estável |
| RN-52 | Só o tutor do pet vê, altera e exclui o pet. Para outro tutor, o pet não existe. | RF-09, RF-10 | estável |
| RN-53 | A lista mostra os pets do tutor que não foram excluídos, em ordem de nome. | RF-09 | estável |
| RN-54 | A foto de perfil é uma imagem JPEG, PNG ou WebP, com no máximo 5 MB (5 × 1.048.576 bytes). | RF-10 | estável |
| RN-55 | Uma foto nova substitui a anterior, e a anterior é apagada do armazenamento. | RF-10 | estável |
| RN-56 | Tamanhos máximos dos textos do pet: nome e raça com 100 caracteres, nome do veterinário e clínica com 120, telefone do veterinário com 30. Os espaços do começo e do fim de cada texto são removidos antes da contagem. Um texto opcional vazio fica sem valor. | RF-09 | estável |

### Biometria do focinho

| ID | Regra | RF | Estado |
|---|---|---|---|
| RN-07 | Só um pet da espécie cachorro tem cadastro biométrico. | RF-11 | estável |
| RN-08 | O vetor é gerado antes de a foto ser salva. Uma foto recusada pela inferência não é gravada. | RF-11 | estável |
| RN-09 | O cadastro novo passa a ser o principal do pet. Os cadastros anteriores continuam ativos. | RF-11 | estável |
| RN-10 | A busca lê os 50 cadastros mais parecidos pelo cosseno, só da mesma versão do modelo. | RF-12 | estável |
| RN-11 | Ficam fora da busca os pets excluídos e os pets de contas que não estão ativas. Os estados da conta entram na fatia 9. Até lá, a busca tira só os pets excluídos. | RF-12 | estável |
| RN-12 | O resultado é agrupado por pet. Vale a foto mais parecida de cada pet. | RF-12 | estável |
| RN-13 | Uma similaridade abaixo de 0,351 não vira candidato. | RF-12 | estável |
| RN-14 | A identificação devolve no máximo 3 candidatos. | RF-12 | estável |
| RN-15 | Um candidato é "correspondência forte" quando a similaridade chega ao limiar do tamanho do acervo. Tabela abaixo. O tamanho do acervo é o número de pets que entram na busca (RN-10, RN-11). Vale a menor linha da tabela que não é menor que o acervo. Acima de 300, vale a linha de 300. | RF-12 | estável |
| RN-16 | A foto da consulta só é gravada quando há confirmação. O tutor do pet confirmado recebe uma notificação. A notificação vem da tarefa `notify_found` (RN-73). | RF-13 | estável |
| RN-59 | A foto do focinho, no cadastro e na identificação, é uma imagem JPEG, PNG ou WebP de até 8 MB (RN-17). | RF-11, RF-12 | estável |
| RN-60 | O cadastro que a API devolve para um pet é o principal (RN-09). | RF-11 | estável |
| RN-85 | O app confere cada foto do focinho antes do cadastro, com a mesma inferência do cadastro (RN-07, RN-21, RN-59). A conferência devolve só a qualidade e não grava a foto nem o vetor. O app cadastra 2 fotos do focinho, e só as fotos que passaram na conferência. | RF-11 | estável |
| RN-86 | A foto do focinho é gravada no cadastro e na identificação e nunca é mostrada depois, nem ao tutor nem a outra pessoa: nenhuma resposta da API tem a foto ou a URL dela. A única foto do cachorro que a API mostra é a foto de perfil do pet, ou a foto ampla de um achado (RN-27). | RF-11, RF-12, RF-19 | estável |
| RN-61 | A identificação aceita a latitude e a longitude de quem encontrou. As duas são opcionais e vêm juntas. A latitude vai de -90 a 90 e a longitude vai de -180 a 180. Um valor que não é um número é recusado. | RF-12 | estável |
| RN-62 | O resultado da identificação não tem dado do tutor. Cada candidato tem o nome e a foto de perfil do pet, a similaridade e a marca de correspondência forte. | RF-12 | estável |
| RN-63 | A confirmação tem o candidato, o nome (obrigatório, até 120 caracteres), o telefone (obrigatório, de 8 a 30 caracteres: dígitos, espaço, `+`, `-`, `(` e `)`) e a mensagem (opcional, até 500 caracteres). Os espaços do começo e do fim são removidos. | RF-13 | estável |
| RN-64 | O candidato da confirmação é da mesma identificação. Uma identificação ou um candidato que não existe recebe 404. | RF-13 | estável |
| RN-65 | Confirmar de novo o mesmo candidato muda só o contato. A data da confirmação fica a da primeira vez. A foto da consulta é a da primeira confirmação que envia uma foto. O contato é da identificação: a confirmação de outro candidato da mesma identificação muda o contato dos avisos dela. | RF-13 | estável |
| RN-66 | O aviso de encontro mostra ao tutor o pet, o nome, o telefone e a mensagem de quem encontrou, o ponto da identificação e a data da confirmação. Os avisos vêm do mais novo para o mais antigo. | RF-14 | estável |
| RN-67 | O recálculo de RF-15 é executado na subida da API. Ele lê a foto guardada de cada cadastro de outra versão do modelo, de pets não excluídos, e grava o vetor novo. Uma foto que a versão nova recusa, ou que não existe mais no armazenamento, fica com o vetor antigo, fora da busca. O recálculo para quando o serviço de inferência, o armazenamento ou o banco falha, e continua na subida seguinte. | RF-15 | estável |

Limiares de correspondência forte (RN-15):

| Tamanho do acervo | Similaridade mínima |
|---|---|
| 25 | 0,737 |
| 50 | 0,765 |
| 100 | 0,785 |
| 200 | 0,788 |
| 300 | 0,793 |

Os valores de RN-13 e RN-15 vêm da calibração do modelo `tinyvit21m-s43`. Eles só valem para essa versão do modelo e para o pré-processamento de referência ([ADR 0007](adr/0007-inferencia-python-onnx.md)).

### Serviço de inferência

| ID | Regra | RF | Estado |
|---|---|---|---|
| RN-17 | A entrada é uma imagem de até 8 MB (8 × 1.048.576 bytes). Uma imagem maior é recusada com 413 `image_too_large`. Um conteúdo que não é uma imagem é recusado com 400 `image_invalid`. | RF-11, RF-12 | estável |
| RN-18 | A saída tem o vetor de 512 dimensões com norma L2 igual a 1, a versão do modelo e a nitidez com 4 casas decimais. | RF-11, RF-12 | estável |
| RN-19 | O modelo é o TinyViT-21M, versão `tinyvit21m-s43`, em ONNX. O vetor final é a soma do vetor da imagem com o vetor do espelho horizontal, normalizada. | RF-11, RF-12 | estável |
| RN-20 | A nitidez é a variância do laplaciano dividida por 0,000832, com máximo de 1,0. A variância divide por N-1. Abaixo de 0,20 a foto é recusada com 422 `image_low_quality`. A nitidez é conferida antes do enquadramento. | RF-11, RF-12 | estável |
| RN-21 | Um detector YOLO11n precisa achar um focinho na foto, com confiança de pelo menos 0,25. Sem focinho, a foto é recusada com 422 `image_framing`. | RF-11, RF-12 | estável |
| RN-22 | O SHA-256 dos arquivos de pesos é conferido na carga. Com um arquivo ausente ou diferente, o serviço não sobe. | RF-11, RF-12 | estável |
| RN-23 | O serviço executa uma inferência por vez. | RF-11, RF-12 | estável |
| RN-57 | A imagem tem no máximo 50 milhões de pixels. Uma imagem maior é recusada com 400 `image_invalid`, antes de os pixels serem lidos. | RF-11, RF-12 | estável |
| RN-58 | A rotação gravada no EXIF da foto é aplicada antes de qualquer cálculo. | RF-11, RF-12 | estável |

### Ocorrências e mural

| ID | Regra | RF | Estado |
|---|---|---|---|
| RN-24 | O mural mostra 20 ocorrências abertas por página, da mais nova para a mais antiga, com as contagens de perdidos e de achados abertos. Um desaparecimento de um pet excluído sai do mural. O mural filtra pelo tipo (perdido ou achado) e pelo raio de 1, 3, 5 ou 10 km em volta de um ponto (RN-61). O ponto e o raio vêm juntos. O raio vale também para as contagens; o tipo não muda as contagens. | RF-16 | estável |
| RN-25 | A ficha de uma ocorrência do tipo perdido mostra os avistamentos dela, do mais antigo para o mais novo. | RF-17 | estável |
| RN-26 | Só o tutor do pet registra o desaparecimento dele. | RF-18 | estável |
| RN-27 | Um achado não pede conta e não pede pet cadastrado. A foto do achado é uma foto ampla do cachorro, tirada por quem achou: uma imagem JPEG, PNG ou WebP de até 8 MB (RN-59). Quem achou faz primeiro, de preferência, o scan do focinho (RF-12); a foto do focinho não vai para o achado (RN-86). A API não liga o achado à identificação. | RF-19 | estável |
| RN-28 | Um avistamento só entra em uma ocorrência do tipo perdido que está aberta. Latitude e longitude vêm juntas ou não vêm. Sem coordenadas, vale o ponto do desaparecimento. | RF-20 | estável |
| RN-29 | Só o autor resolve a ocorrência. Uma ocorrência resolvida sai do mural e não recebe avistamentos. Resolver de novo não muda nada. | RF-21 | estável |
| RN-68 | Um pet tem no máximo um desaparecimento aberto. Um segundo registro recebe 409 `lost_report_open`. | RF-18 | estável |
| RN-69 | Um achado registrado sem conta recebe, na criação, um código de 256 bits. Só o SHA-256 do código vai para o banco. Quem tem o código resolve o achado. A resposta mostra o código uma vez. | RF-19, RF-21 | estável |
| RN-70 | O desaparecimento e o achado têm latitude e longitude obrigatórias, de um ponto da Terra (RN-61). O recado tem no máximo 1.000 caracteres, e o nome do local tem no máximo 200. Os espaços do começo e do fim são removidos, e um texto vazio fica sem valor. | RF-18, RF-19, RF-20 | estável |
| RN-71 | A data do desaparecimento é opcional e não é futura. Sem data, vale o momento do registro. | RF-18 | estável |
| RN-72 | O mural e a ficha não têm dado do autor nem de quem avistou. Um desaparecimento mostra o nome, a espécie e a foto de perfil do pet, e diz se o pet tem cadastro biométrico. | RF-16, RF-17 | estável |

### Alertas

| ID | Regra | RF | Estado |
|---|---|---|---|
| RN-30 | O sistema guarda só a última localização do tutor. | RF-22 | estável |
| RN-31 | Um token de push pertence ao tutor que fez o último registro dele. Registrar de novo um token de outro tutor passa o token para o tutor atual. O tutor remove só um token dele. | RF-23 | estável |
| RN-32 | O alerta de proximidade vai para os tutores com a última localização a até 3.000 m do ponto do desaparecimento, com a borda incluída. | RF-24 | estável |
| RN-33 | O alerta de proximidade vai para no máximo 100 tutores, os mais próximos. | RF-24 | estável |
| RN-34 | O autor da ocorrência não recebe o alerta de proximidade. | RF-24 | estável |
| RN-35 | A lista mostra as 50 notificações mais recentes. A notificação existe na lista mesmo quando o push não sai. | RF-25 | estável |
| RN-36 | O push só é enviado com a credencial configurada. Sem a credencial, a notificação fica como não enviada. Um token que o Cloud Messaging diz que não está mais registrado é desativado. | RF-26 | estável |
| RN-73 | Um avistamento cria uma notificação para o tutor do pet. Uma confirmação de encontro também (RN-16). | RF-20, RF-13, RF-25 | estável |
| RN-74 | Uma notificação de outro tutor não existe para quem chama. Marcar de novo como lida não muda a data. O tutor marca todas as notificações dele como lidas de uma vez. | RF-25 | estável |
| RN-75 | A localização do tutor tem latitude e longitude de um ponto da Terra (RN-61). | RF-22 | estável |

### Saúde

| ID | Regra | RF | Estado |
|---|---|---|---|
| RN-37 | Uma medicação tem nome (obrigatório), categoria (medicação, antipulgas ou vermífugo), princípio ativo, dosagem, frequência, data de fim, se está em uso, intervalo em dias (de 1 a 365) e a opção de lembrar. Com a opção de lembrar, o intervalo é obrigatório. A data do evento é o início. A data de fim não é anterior ao início. | RF-27 | estável |
| RN-38 | Uma anotação tem categoria (doença, peso, alergia, cirurgia, nota ou sintoma) e título (obrigatório), e pode levar o peso do pet (RN-51). | RF-27 | estável |
| RN-76 | Todo evento tem tipo, data e observações (opcional, até 2.000 caracteres). A data do evento não é futura. Só o tutor do pet vê e muda os eventos dele (RN-52). | RF-27 | estável |
| RN-77 | Uma vacina tem nome (obrigatório), fabricante, lote, dose, veterinário, data da próxima dose (não anterior à data do evento) e a opção de lembrar. Com a opção de lembrar, a data da próxima dose é obrigatória. | RF-27 | estável |
| RN-78 | Uma consulta tem motivo (obrigatório), clínica, veterinário, diagnóstico, peso do pet (RN-51) e data de retorno (não anterior à data do evento). | RF-27 | estável |
| RN-79 | Um exame tem nome (obrigatório), laboratório, veterinário e resultado. | RF-27 | estável |
| RN-80 | Os textos curtos de um evento (nomes, dose, lote, frequência, dosagem) têm até 120 caracteres. Os textos longos (observações, diagnóstico, resultado) têm até 2.000. Os espaços do começo e do fim são removidos, e um texto vazio fica sem valor. Um campo de outro tipo de evento é recusado. | RF-27 | estável |
| RN-81 | Os próximos cuidados são: a próxima dose de uma vacina com a opção de lembrar, e a data de uma medicação em uso com a opção de lembrar, somada ao intervalo. Para cada vacina pelo nome, e para cada medicação pela categoria (antipulgas, vermífugo) ou pelo nome, vale só o evento mais novo. A lista vem da data mais próxima para a mais distante. | RF-29 | estável |
| RN-82 | Um anexo é uma imagem JPEG, PNG ou WebP, ou um PDF, com até 10 MB. O tipo é conferido pelo conteúdo. Um evento tem no máximo 10 anexos. Apagar um evento apaga os anexos dele. | RF-28 | estável |

### Carteirinha

| ID | Regra | RF | Estado |
|---|---|---|---|
| RN-39 | O link usa um token de 256 bits. Só o SHA-256 do token vai para o banco. O token aparece só na resposta da criação. | RF-30 | estável |
| RN-40 | O link vale 1, 7 ou 30 dias, à escolha do tutor. Sem escolha, vale 30 dias. O tutor revoga o link a qualquer hora. O link conta as aberturas, e o tutor vê os links ativos com as aberturas. | RF-30 | estável |
| RN-41 | Um link desconhecido, revogado, vencido ou de um pet excluído devolve 404. | RF-31 | estável |
| RN-83 | A carteirinha mostra o pet (nome, espécie, raça, sexo, data de nascimento, peso, castração e foto), o veterinário do pet (nome, clínica e telefone), as vacinas (nome, data, próxima dose, fabricante, lote, dose e veterinário) e as medicações antipulgas e vermífugo (nome, categoria, data e intervalo), da mais nova para a mais antiga. Quando o tutor inclui os exames no link, ela mostra também os exames (nome, data, laboratório e resultado). Ela não mostra dados do tutor, IDs internos nem anexos. A URL temporária da foto tem a chave do arquivo no armazenamento. | RF-31 | estável |

### Privacidade e endpoints públicos

| ID | Regra | RF | Estado |
|---|---|---|---|
| RN-42 | Todo dia às 3h, no fuso de Brasília (`America/Sao_Paulo`), o sistema apaga o que tem mais de 30 dias: o contato deixado por visitantes (também no texto da notificação de encontro e nas tarefas terminadas), a foto da consulta e a última localização do tutor. Um aviso de encontro sem o contato sai da lista do tutor. | RF-32 | estável |
| RN-43 | Um endpoint público aceita no máximo 10 `POST` por minuto, por IP e por caminho. | RF-12, RF-13, RF-19, RF-20, RF-31 | estável |

## Requisitos não funcionais

| ID | Requisito | Como é atendido |
|---|---|---|
| RNF-01 | Um alerta de desaparecimento não se perde quando o processo para. | A tarefa é gravada na mesma transação da ocorrência ([ADR 0003](adr/0003-estado-postgres-fila-no-banco.md)). |
| RNF-02 | Uma tarefa em segundo plano que falha é tentada de novo, com espera crescente: 10 s, 20 s, 40 s e 80 s. Depois de 5 tentativas, a tarefa fica marcada como falha. Toda tarefa é segura para executar duas vezes. | Fila de tarefas ([ADR 0003](adr/0003-estado-postgres-fila-no-banco.md)). |
| RNF-03 | A API não guarda senha. O token da carteirinha fica no banco só como hash. A política de privacidade diz onde ficam o e-mail e a senha do tutor. | [ADR 0008](adr/0008-autenticacao-firebase.md), RN-39. |
| RNF-04 | O visitante usa os fluxos públicos sem conta e sem instalar nada. No app, o mural, a ocorrência, o achei um cachorro e os termos também abrem sem conta. | Web pública ([ADR 0006](adr/0006-mobile-expo-web-publica.md)). |
| RNF-05 | O app funciona em Android e iOS. A web pública funciona em um navegador de celular. | [ADR 0006](adr/0006-mobile-expo-web-publica.md). |
| RNF-06 | Um processo não sobe com configuração inválida ou com um arquivo de pesos diferente do esperado. | Validação na subida, RN-22. |
| RNF-07 | Toda requisição tem um identificador que aparece em todas as linhas de log dela. | `log/slog` com saída JSON ([arquitetura.md](arquitetura.md)). |
| RNF-08 | A API responde o que o contrato declara. | Contrato OpenAPI e teste de contrato ([ADR 0005](adr/0005-contrato-openapi.md)). |
| RNF-09 | Toda RN tem um teste que cita o identificador dela. | Estratégia de testes ([arquitetura.md](arquitetura.md)). |

Limite conhecido de RN-43: a contagem fica na memória do processo. Ela vale para uma instância da API e zera quando o processo sobe ([ADR 0003](adr/0003-estado-postgres-fila-no-banco.md)). O IP é o endereço da conexão. O minuto começa na primeira chamada do endereço para a rota.

## Uso do modelo

O modelo `tinyvit21m-s43` foi treinado com um conjunto de dados cujos termos limitam o uso a fins sem lucro. A v1 do Nupii não tem fins lucrativos. Uma cobrança ou um uso comercial pede, antes, uma nova leitura desses termos ou um modelo treinado com outro conjunto.

## Em aberto

Cada item é fechado na fatia indicada, antes do código.

| Fatia | Pergunta | Item |
|---|---|---|
| 10 | O que acontece quando um login com Google usa o e-mail de uma conta que já tem senha? | RN-02 |
| 10 | De onde a API lê o endereço do cliente quando fica atrás de um proxy? Hoje ela usa o endereço da conexão. | RN-43 |
| 7 | Em qual fuso horário vale a data de hoje para uma data que o tutor informa? Hoje a API usa a data em UTC. | RN-50 |
