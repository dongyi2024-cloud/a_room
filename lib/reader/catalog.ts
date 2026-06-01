export const BOOK_CATALOG = [
  {
    id: "room-of-ones-own",
    jsonPath: "epub/output/Room_of_Ones_Own_Virginia_Woolf_z-library.sk_1lib.sk_z-lib.sk.json"
  },
  {
    id: "sheng-si-chang",
    jsonPath: "epub/output/生死场_萧红小说精选集_萧红_z-library.sk_1lib.sk_z-lib.sk.json"
  }
] as const;

export type ReaderBookId = (typeof BOOK_CATALOG)[number]["id"];
