export interface Municipality {
  id: string;
  name: string;
}

export interface Province {
  id: string;
  name: string;
  municipalities: Municipality[];
}

export interface CountryLocations {
  [countryCode: string]: Province[];
}

// Angola provinces (atualizado 2025 com novas províncias)
const angolaProvinces: Province[] = [
  {
    id: "luanda", name: "Luanda",
    municipalities: [
      { id: "luanda", name: "Município de Luanda" },
      { id: "viana", name: "Município de Viana" },
      { id: "talatona", name: "Município de Talatona" },
      { id: "belas", name: "Município de Belas" },
      { id: "cazenga", name: "Município do Cazenga" },
      { id: "cacuaco", name: "Município de Cacuaco" }
    ]
  },
  {
    id: "icolo-e-bengo", name: "Icolo e Bengo",
    municipalities: [
      { id: "icolo-e-bengo", name: "Município de Icolo e Bengo" },
      { id: "quissama", name: "Município da Quissama" }
    ]
  },
  {
    id: "benguela", name: "Benguela",
    municipalities: [
      { id: "benguela", name: "Município de Benguela" },
      { id: "lobito", name: "Município do Lobito" },
      { id: "catumbela", name: "Município da Catumbela" },
      { id: "baia-farta", name: "Município da Baía Farta" }
    ]
  },
  {
    id: "huambo", name: "Huambo",
    municipalities: [
      { id: "huambo", name: "Município do Huambo" },
      { id: "caala", name: "Município da Caála" },
      { id: "bailundo", name: "Município do Bailundo" }
    ]
  },
  {
    id: "huila", name: "Huíla",
    municipalities: [
      { id: "lubango", name: "Município do Lubango" },
      { id: "humpata", name: "Município da Humpata" },
      { id: "chibia", name: "Município da Chibia" }
    ]
  },
  {
    id: "cabinda", name: "Cabinda",
    municipalities: [
      { id: "cabinda", name: "Município de Cabinda" },
      { id: "cacongo", name: "Município de Cacongo" }
    ]
  },
  {
    id: "bengo", name: "Bengo",
    municipalities: [
      { id: "dande", name: "Município do Dande" },
      { id: "ambriz", name: "Município do Ambriz" }
    ]
  },
  {
    id: "zaire", name: "Zaire",
    municipalities: [
      { id: "mbanza-congo", name: "Município de Mbanza Congo" },
      { id: "soyo", name: "Município do Soyo" }
    ]
  },
  {
    id: "uige", name: "Uíge",
    municipalities: [
      { id: "uige", name: "Município do Uíge" },
      { id: "negage", name: "Município do Negage" }
    ]
  },
  {
    id: "cuanza-norte", name: "Cuanza Norte",
    municipalities: [
      { id: "cazengo", name: "Município do Cazengo" },
      { id: "cambambe", name: "Município de Cambambe" }
    ]
  },
  {
    id: "cuanza-sul", name: "Cuanza Sul",
    municipalities: [
      { id: "sumbe", name: "Município do Sumbe" },
      { id: "porto-amboim", name: "Município de Porto Amboim" }
    ]
  },
  {
    id: "malanje", name: "Malanje",
    municipalities: [
      { id: "malanje", name: "Município de Malanje" },
      { id: "calandula", name: "Município de Calandula" }
    ]
  },
  {
    id: "lunda-norte", name: "Lunda Norte",
    municipalities: [
      { id: "chitato", name: "Município do Chitato" },
      { id: "cuango", name: "Município do Cuango" }
    ]
  },
  {
    id: "lunda-sul", name: "Lunda Sul",
    municipalities: [
      { id: "saurimo", name: "Município de Saurimo" }
    ]
  },
  {
    id: "bie", name: "Bié",
    municipalities: [
      { id: "cuito", name: "Município do Cuíto" },
      { id: "andulo", name: "Município do Andulo" }
    ]
  },
  {
    id: "moxico", name: "Moxico",
    municipalities: [
      { id: "moxico-luena", name: "Município do Moxico/Luena" }
    ]
  },
  {
    id: "moxico-leste", name: "Moxico Leste",
    municipalities: [
      { id: "alto-zambeze", name: "Município do Alto Zambeze" }
    ]
  },
  {
    id: "namibe", name: "Namibe",
    municipalities: [
      { id: "mocamedes", name: "Município de Moçâmedes" },
      { id: "tombwa", name: "Município do Tômbwa" }
    ]
  },
  {
    id: "cunene", name: "Cunene",
    municipalities: [
      { id: "cuanhama", name: "Município do Cuanhama" },
      { id: "namacunde", name: "Município de Namacunde" }
    ]
  },
  {
    id: "cuando-cubango", name: "Cuando Cubango",
    municipalities: [
      { id: "menongue", name: "Município de Menongue" },
      { id: "cuito-cuanavale", name: "Município do Cuito Cuanavale" }
    ]
  },
  {
    id: "cuando", name: "Cuando",
    municipalities: [
      { id: "mavinga", name: "Município de Mavinga" },
      { id: "rivungo", name: "Município de Rivungo" }
    ]
  }
];

// DR Congo provinces
const congoProvinces: Province[] = [
  {
    id: "kinshasa", name: "Kinshasa",
    municipalities: [
      { id: "gombe", name: "Gombe" },
      { id: "lingwala", name: "Lingwala" },
      { id: "barumbu", name: "Barumbu" },
      { id: "kinshasa-city", name: "Kinshasa" }
    ]
  },
  {
    id: "kongo-central", name: "Kongo Central",
    municipalities: [
      { id: "matadi", name: "Matadi" },
      { id: "boma", name: "Boma" },
      { id: "muanda", name: "Muanda" }
    ]
  },
  {
    id: "katanga", name: "Haut-Katanga",
    municipalities: [
      { id: "lubumbashi", name: "Lubumbashi" },
      { id: "likasi", name: "Likasi" },
      { id: "kolwezi", name: "Kolwezi" }
    ]
  },
  {
    id: "nord-kivu", name: "Nord-Kivu",
    municipalities: [
      { id: "goma", name: "Goma" },
      { id: "butembo", name: "Butembo" },
      { id: "beni", name: "Beni" }
    ]
  },
  {
    id: "sud-kivu", name: "Sud-Kivu",
    municipalities: [
      { id: "bukavu", name: "Bukavu" },
      { id: "uvira", name: "Uvira" }
    ]
  },
  {
    id: "kasai", name: "Kasaï",
    municipalities: [
      { id: "tshikapa", name: "Tshikapa" },
      { id: "kananga", name: "Kananga" }
    ]
  },
  {
    id: "equateur", name: "Équateur",
    municipalities: [
      { id: "mbandaka", name: "Mbandaka" },
      { id: "gemena", name: "Gemena" }
    ]
  }
];

// South Africa provinces
const southAfricaProvinces: Province[] = [
  {
    id: "gauteng", name: "Gauteng",
    municipalities: [
      { id: "johannesburg", name: "Johannesburg" },
      { id: "pretoria", name: "Pretoria" },
      { id: "soweto", name: "Soweto" },
      { id: "sandton", name: "Sandton" }
    ]
  },
  {
    id: "western-cape", name: "Western Cape",
    municipalities: [
      { id: "cape-town", name: "Cape Town" },
      { id: "stellenbosch", name: "Stellenbosch" },
      { id: "paarl", name: "Paarl" }
    ]
  },
  {
    id: "kwazulu-natal", name: "KwaZulu-Natal",
    municipalities: [
      { id: "durban", name: "Durban" },
      { id: "pietermaritzburg", name: "Pietermaritzburg" },
      { id: "richards-bay", name: "Richards Bay" }
    ]
  },
  {
    id: "eastern-cape", name: "Eastern Cape",
    municipalities: [
      { id: "port-elizabeth", name: "Port Elizabeth" },
      { id: "east-london", name: "East London" }
    ]
  },
  {
    id: "limpopo", name: "Limpopo",
    municipalities: [
      { id: "polokwane", name: "Polokwane" },
      { id: "tzaneen", name: "Tzaneen" }
    ]
  },
  {
    id: "mpumalanga", name: "Mpumalanga",
    municipalities: [
      { id: "nelspruit", name: "Nelspruit" },
      { id: "witbank", name: "Witbank" }
    ]
  },
  {
    id: "free-state", name: "Free State",
    municipalities: [
      { id: "bloemfontein", name: "Bloemfontein" },
      { id: "welkom", name: "Welkom" }
    ]
  },
  {
    id: "north-west", name: "North West",
    municipalities: [
      { id: "rustenburg", name: "Rustenburg" },
      { id: "klerksdorp", name: "Klerksdorp" }
    ]
  },
  {
    id: "northern-cape", name: "Northern Cape",
    municipalities: [
      { id: "kimberley", name: "Kimberley" },
      { id: "upington", name: "Upington" }
    ]
  }
];

// UK regions/counties
const ukProvinces: Province[] = [
  {
    id: "london", name: "London",
    municipalities: [
      { id: "central-london", name: "Central London" },
      { id: "westminster", name: "Westminster" },
      { id: "camden", name: "Camden" },
      { id: "greenwich", name: "Greenwich" }
    ]
  },
  {
    id: "south-east", name: "South East",
    municipalities: [
      { id: "brighton", name: "Brighton" },
      { id: "oxford", name: "Oxford" },
      { id: "reading", name: "Reading" }
    ]
  },
  {
    id: "north-west", name: "North West",
    municipalities: [
      { id: "manchester", name: "Manchester" },
      { id: "liverpool", name: "Liverpool" },
      { id: "preston", name: "Preston" }
    ]
  },
  {
    id: "west-midlands", name: "West Midlands",
    municipalities: [
      { id: "birmingham", name: "Birmingham" },
      { id: "coventry", name: "Coventry" }
    ]
  },
  {
    id: "yorkshire", name: "Yorkshire",
    municipalities: [
      { id: "leeds", name: "Leeds" },
      { id: "sheffield", name: "Sheffield" },
      { id: "york", name: "York" }
    ]
  },
  {
    id: "scotland", name: "Scotland",
    municipalities: [
      { id: "edinburgh", name: "Edinburgh" },
      { id: "glasgow", name: "Glasgow" },
      { id: "aberdeen", name: "Aberdeen" }
    ]
  },
  {
    id: "wales", name: "Wales",
    municipalities: [
      { id: "cardiff", name: "Cardiff" },
      { id: "swansea", name: "Swansea" }
    ]
  },
  {
    id: "northern-ireland", name: "Northern Ireland",
    municipalities: [
      { id: "belfast", name: "Belfast" },
      { id: "derry", name: "Derry" }
    ]
  }
];

export const countryLocations: CountryLocations = {
  AO: angolaProvinces,
  CD: congoProvinces,
  ZA: southAfricaProvinces,
  GB: ukProvinces
};

export const getProvincesForCountry = (countryCode: string): Province[] => {
  return countryLocations[countryCode] || [];
};

export const getProvinceLabel = (countryCode: string): string => {
  const labels: { [key: string]: string } = {
    AO: 'Província',
    CD: 'Province',
    ZA: 'Province',
    GB: 'Region'
  };
  return labels[countryCode] || 'Province';
};

export const getMunicipalityLabel = (countryCode: string): string => {
  const labels: { [key: string]: string } = {
    AO: 'Município',
    CD: 'Commune',
    ZA: 'City',
    GB: 'City'
  };
  return labels[countryCode] || 'City';
};
