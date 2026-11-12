import type { components } from "./api/schema";

/**
 * Version of the terms of use that the app shows. The type comes from the
 * contract: when the contract gets a new version, this line stops compiling.
 */
export const TERMS_VERSION: components["schemas"]["TermsVersion"] = "2026-11-11";

/** A section of the terms of use and of the privacy policy. */
export type TermsSection = { title: string; paragraphs: string[] };

/** Contact for the requests of the person that the data is about (LGPD). */
export const PRIVACY_CONTACT = "nupii@codaline.com.br";

/** Text of the terms of use and of the privacy policy, version TERMS_VERSION. */
export const TERMS_SECTIONS: TermsSection[] = [
  {
    title: "1. O que é o Nupii",
    paragraphs: [
      "O Nupii ajuda tutores a cuidar dos pets: saúde, carteirinha, mural de perdidos e achados e identificação de cães pela foto do focinho. O controlador dos dados é o Nupii. Contato: " +
        PRIVACY_CONTACT +
        ".",
      "O Nupii não tem fins lucrativos. Ele não vende dados e não mostra anúncios.",
    ],
  },
  {
    title: "2. Regras de uso",
    paragraphs: [
      "Você é responsável pelo que publica: dados dos seus pets, fotos, ocorrências, avistamentos e contatos. Não publique dados de outras pessoas sem permissão.",
      "A identificação pelo focinho mostra os pets mais parecidos. Ela é uma sugestão e pode errar. Quem encontrou o cão confirma o pet.",
      "Os registros de saúde são anotações do tutor. Eles não substituem o veterinário.",
      "Podemos tirar do ar um conteúdo ou uma conta que viole estes termos ou a lei.",
    ],
  },
  {
    title: "3. Dados que guardamos",
    paragraphs: [
      "Conta: e-mail, nome e a data e a versão dos termos que você aceitou. A senha fica só no Firebase Authentication, do Google. O Nupii não guarda a senha.",
      "Pets: os dados que você informa (nome, espécie, raça, sexo, porte, nascimento, peso, castração, veterinário e foto), as fotos do focinho e o vetor calculado de cada foto, e os eventos de saúde com os anexos.",
      "Localização: a última posição do aparelho, quando você abre o app e permite. Ela serve para avisar você de um pet perdido perto. Também guardamos o ponto de um desaparecimento, de um achado ou de um avistamento que você registra.",
      "Aparelho: o token de notificação, para enviar avisos por push.",
      "Visitantes: quem usa a web sem conta pode enviar a foto de um focinho, o ponto onde achou o cão, um avistamento e um contato (nome, telefone e recado) para o tutor. A foto da consulta só é guardada quando o visitante confirma um pet.",
      "A API não grava o endereço IP nos registros das requisições. O limite de tentativas guarda o IP na memória por 1 minuto.",
    ],
  },
  {
    title: "4. Para que usamos os dados",
    paragraphs: [
      "Para fazer o serviço funcionar: a sua conta, os seus pets, a carteirinha, o mural, a identificação e os avisos. Base legal: a execução do serviço que você pediu.",
      "A localização e o push dependem da sua permissão no aparelho. Você pode tirar a permissão a qualquer hora.",
      "Para a segurança do serviço, como o limite de tentativas. Base legal: o interesse legítimo.",
    ],
  },
  {
    title: "5. O que fica público",
    paragraphs: [
      "Um desaparecimento ou um achado aparece no mural público com o nome e a foto do pet, o ponto no mapa, o lugar e a descrição. O seu e-mail e o seu nome não aparecem.",
      "O link da carteirinha mostra a saúde do pet a quem tem o link, por 30 dias ou até você revogar. A carteirinha não mostra os seus dados.",
      "Quando um visitante confirma o seu pet, você recebe o contato que ele deixou.",
    ],
  },
  {
    title: "6. Quem recebe os dados",
    paragraphs: [
      "Os servidores do Nupii ficam no Brasil.",
      "O Google (Firebase Authentication e Firebase Cloud Messaging) trata o e-mail, a senha e os tokens de notificação. Esses serviços podem guardar os dados fora do Brasil, com as garantias do Google.",
      "O mapa carrega a biblioteca Leaflet do unpkg.com e as imagens do mapa do OpenStreetMap. Esses serviços recebem o endereço IP do seu aparelho.",
      "Não vendemos nem compartilhamos dados com outras empresas.",
    ],
  },
  {
    title: "7. Por quanto tempo guardamos",
    paragraphs: [
      "O contato deixado por visitantes, a foto da consulta e a sua última localização são apagados depois de 30 dias.",
      "Os outros dados ficam enquanto a conta existe. Quando você exclui a conta, apagamos os seus dados e os dos seus pets, e o usuário sai do Firebase. Ficam só registros sem identificação, como um avistamento feito por um visitante.",
    ],
  },
  {
    title: "8. Os seus direitos",
    paragraphs: [
      "Você vê e altera o seu nome em \"Meu perfil\", e os dados dos pets nas telas de cada pet. Em \"Meu perfil\" você também exclui a conta.",
      "Para os outros direitos da LGPD (confirmação, acesso, correção, portabilidade, informação sobre o compartilhamento e revogação do consentimento), escreva para " +
        PRIVACY_CONTACT +
        ".",
    ],
  },
  {
    title: "9. Mudanças",
    paragraphs: [
      "Uma versão nova destes termos é publicada no app e em app.nupii.com.br/terms, com a data da versão.",
    ],
  },
];
