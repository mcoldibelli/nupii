import { PRIVACY_CONTACT, TERMS_SECTIONS } from "./terms";

const text = TERMS_SECTIONS.flatMap((section) => [section.title, ...section.paragraphs]).join("\n");

describe("terms of use and privacy policy", () => {
  it("RNF-03: says where the e-mail and the password of the owner are kept", () => {
    expect(text).toContain("A senha fica só no Firebase Authentication");
    expect(text).toContain("O Nupii não guarda a senha");
  });

  it("RN-42: says that the visitor contact, the consult photo and the location go after 30 days", () => {
    expect(text).toContain("O contato deixado por visitantes, a foto da consulta e a sua última localização são apagados depois de 30 dias.");
  });

  it("gives the contact for the requests of the LGPD", () => {
    expect(PRIVACY_CONTACT).toBe("nupii@codaline.com.br");
    expect(text).toContain(PRIVACY_CONTACT);
  });
});
