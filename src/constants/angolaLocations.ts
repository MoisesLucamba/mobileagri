export type Municipality = {
  id: string;
  name: string;
};

export type Province = {
  id: string;
  name: string;
  municipalities: Municipality[];
};

const municipalities = (provinceId: string, names: string[]): Municipality[] =>
  names.map((name) => ({
    id: `${provinceId}-${name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")}`,
    name,
  }));

export const angolaProvinces: Province[] = [
  {
    id: "bengo",
    name: "Bengo",
    municipalities: municipalities("bengo", [
      "Ambriz",
      "Dande",
      "Dembos",
      "Nambuangongo",
      "Pango Aluquém",
    ]),
  },
  {
    id: "benguela",
    name: "Benguela",
    municipalities: municipalities("benguela", [
      "Balombo",
      "Baía Farta",
      "Benguela",
      "Bocoio",
      "Caimbambo",
      "Catumbela",
      "Chongoroi",
      "Cubal",
      "Ganda",
      "Lobito",
    ]),
  },
  {
    id: "bie",
    name: "Bié",
    municipalities: municipalities("bie", [
      "Andulo",
      "Camacupa",
      "Catabola",
      "Chinguar",
      "Chitembo",
      "Cuemba",
      "Cunhinga",
      "Cuito",
      "Nharea",
    ]),
  },
  {
    id: "cabinda",
    name: "Cabinda",
    municipalities: municipalities("cabinda", [
      "Belize",
      "Buco-Zau",
      "Cabinda",
      "Cacongo",
    ]),
  },
  {
    id: "cuando-cubango",
    name: "Cuando Cubango",
    municipalities: municipalities("cuando-cubango", [
      "Calai",
      "Cuchi",
      "Cuangar",
      "Dirico",
      "Mavinga",
      "Menongue",
      "Nancova",
      "Rivungo",
    ]),
  },
  {
    id: "cuanza-norte",
    name: "Cuanza Norte",
    municipalities: municipalities("cuanza-norte", [
      "Ambaca",
      "Banga",
      "Bolongongo",
      "Cambambe",
      "Cazengo",
      "Golungo Alto",
      "Lucala",
      "Quiculungo",
      "Samba Caju",
    ]),
  },
  {
    id: "cuanza-sul",
    name: "Cuanza Sul",
    municipalities: municipalities("cuanza-sul", [
      "Amboim",
      "Cassongue",
      "Conda",
      "Ebo",
      "Libolo",
      "Mussende",
      "Porto Amboim",
      "Quibala",
      "Quilenda",
      "Seles",
      "Sumbe",
    ]),
  },
  {
    id: "cunene",
    name: "Cunene",
    municipalities: municipalities("cunene", [
      "Cahama",
      "Cuanhama",
      "Curoca",
      "Cuvelai",
      "Namacunde",
      "Ombadja",
    ]),
  },
  {
    id: "huambo",
    name: "Huambo",
    municipalities: municipalities("huambo", [
      "Bailundo",
      "Caála",
      "Catchiungo",
      "Ecunha",
      "Huambo",
      "Londuimbali",
      "Longonjo",
      "Mungo",
      "Tchicala-Tcholoanga",
      "Tchindjenje",
      "Ucuma",
    ]),
  },
  {
    id: "huila",
    name: "Huíla",
    municipalities: municipalities("huila", [
      "Caconda",
      "Caluquembe",
      "Chibia",
      "Chipindo",
      "Cuvango",
      "Humpata",
      "Jamba",
      "Lubango",
      "Matala",
      "Quilengues",
      "Quipungo",
    ]),
  },
  {
    id: "luanda",
    name: "Luanda",
    municipalities: municipalities("luanda", [
      "Belas",
      "Cacuaco",
      "Cazenga",
      "Kilamba Kiaxi",
      "Luanda",
      "Talatona",
      "Viana",
    ]),
  },
  {
    id: "lunda-norte",
    name: "Lunda Norte",
    municipalities: municipalities("lunda-norte", [
      "Cambulo",
      "Capenda Camulemba",
      "Caungula",
      "Chitato",
      "Cuango",
      "Cuílo",
      "Xá-Muteba",
    ]),
  },
  {
    id: "lunda-sul",
    name: "Lunda Sul",
    municipalities: municipalities("lunda-sul", [
      "Cacolo",
      "Dala",
      "Muconda",
      "Saurimo",
    ]),
  },
  {
    id: "malanje",
    name: "Malanje",
    municipalities: municipalities("malanje", [
      "Cacuso",
      "Calandula",
      "Cambundi Catembo",
      "Cangandala",
      "Caombo",
      "Cuaba Nzogo",
      "Cunda-Dia-Baze",
      "Luquembo",
      "Malanje",
      "Marimba",
      "Massango",
      "Mucari",
      "Quela",
      "Quirima",
    ]),
  },
  {
    id: "moxico",
    name: "Moxico",
    municipalities: municipalities("moxico", [
      "Alto Zambeze",
      "Bundas",
      "Camanongue",
      "Cameia",
      "Léua",
      "Luacano",
      "Luau",
      "Luchazes",
      "Luena",
    ]),
  },
  {
    id: "namibe",
    name: "Namibe",
    municipalities: municipalities("namibe", [
      "Bibala",
      "Camucuio",
      "Moçâmedes",
      "Tômbwa",
      "Virei",
    ]),
  },
  {
    id: "uige",
    name: "Uíge",
    municipalities: municipalities("uige", [
      "Alto Cauale",
      "Ambuíla",
      "Bembe",
      "Buengas",
      "Bungo",
      "Damba",
      "Maquela do Zombo",
      "Mucaba",
      "Negage",
      "Puri",
      "Quimbele",
      "Quitexe",
      "Sanza Pombo",
      "Songo",
      "Uíge",
    ]),
  },
  {
    id: "zaire",
    name: "Zaire",
    municipalities: municipalities("zaire", [
      "Cuimba",
      "Mbanza Kongo",
      "Nóqui",
      "Nzeto",
      "Soyo",
      "Tomboco",
    ]),
  },
];

export default angolaProvinces;
