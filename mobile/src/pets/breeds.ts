/** The breed of a dog with no defined breed. */
export const SRD = "SRD (sem raça definida)";

/** The dog breeds that the owner chooses from (RN-48), in Portuguese, SRD first. */
export const BREEDS: readonly string[] = [
  SRD,
  "Akita",
  "Basset Hound",
  "Beagle",
  "Bernese",
  "Bichon Frisé",
  "Border Collie",
  "Boston Terrier",
  "Boxer",
  "Bull Terrier",
  "Buldogue Francês",
  "Buldogue Inglês",
  "Cane Corso",
  "Cavalier King Charles Spaniel",
  "Chihuahua",
  "Chow Chow",
  "Cocker Spaniel",
  "Dachshund (Salsicha)",
  "Dálmata",
  "Doberman",
  "Dogo Argentino",
  "Fila Brasileiro",
  "Fox Paulistinha",
  "Golden Retriever",
  "Husky Siberiano",
  "Jack Russell Terrier",
  "Labrador Retriever",
  "Lhasa Apso",
  "Malamute do Alasca",
  "Maltês",
  "Pastor Alemão",
  "Pastor Australiano",
  "Pastor Belga Malinois",
  "Pastor de Shetland",
  "Pequinês",
  "Pinscher",
  "Pit Bull",
  "Poodle",
  "Pug",
  "Rottweiler",
  "Samoieda",
  "Schnauzer",
  "Shar-Pei",
  "Shiba Inu",
  "Shih Tzu",
  "Spitz Alemão (Lulu da Pomerânia)",
  "Staffordshire Bull Terrier",
  "Weimaraner",
  "West Highland White Terrier",
  "Whippet",
  "Yorkshire Terrier",
];

const plain = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** The breeds whose name has the text, without accents or case; SRD stays at the top. */
export function searchBreeds(text: string): readonly string[] {
  const query = plain(text.trim());
  if (query === "") {
    return BREEDS;
  }
  return [SRD, ...BREEDS.slice(1).filter((breed) => plain(breed).includes(query))];
}
