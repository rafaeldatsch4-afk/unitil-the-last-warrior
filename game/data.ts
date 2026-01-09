
import { CharacterData } from './types';

export const INITIAL_CHARACTERS: CharacterData[] = [
  {
    id: 0,
    key: "goku",
    name: "Goku",
    price: 0,
    unlocked: true,
    maxHp: 220,
    transformAvailable: true,
    sprite: "assets/sprites/goku_spritesheet.png",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "KAMEHAMEHA",
    specialColor: 0x00ffff
  },
  {
    id: 1,
    key: "vegeta",
    name: "Vegeta",
    price: 0,
    unlocked: true,
    maxHp: 210,
    transformAvailable: true,
    sprite: "assets/sprites/vegeta_spritesheet.png",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "GALICK GUN",
    specialColor: 0x9b59b6
  },
  {
    id: 2,
    key: "gohan",
    name: "Gohan",
    price: 300,
    unlocked: true,
    maxHp: 200,
    transformAvailable: true,
    sprite: "assets/sprites/gohan_spritesheet.png",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "MASENKO",
    specialColor: 0xffff00
  },
  {
    id: 3,
    key: "piccolo",
    name: "Piccolo",
    price: 300,
    unlocked: true,
    maxHp: 230,
    transformAvailable: true,
    sprite: "assets/sprites/piccolo_spritesheet.png",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "MAKANKOSAPPO",
    specialColor: 0xffff00
  },
  {
    id: 4,
    key: "frieza",
    name: "Frieza",
    price: 500,
    unlocked: false,
    maxHp: 190,
    transformAvailable: true,
    sprite: "",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "DEATH BEAM",
    specialColor: 0xff00ff
  },
  {
    id: 5,
    key: "cell",
    name: "Cell",
    price: 550,
    unlocked: false,
    maxHp: 240,
    transformAvailable: true,
    sprite: "",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "KAMEHAMEHA",
    specialColor: 0x00ff00
  },
  {
    id: 6,
    key: "leonardo",
    name: "Leonardo",
    price: 600,
    unlocked: false,
    maxHp: 210,
    transformAvailable: false,
    sprite: "",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "KATANA SLASH",
    specialColor: 0x3498db
  },
  {
    id: 7,
    key: "frieren",
    name: "Frieren",
    price: 700,
    unlocked: false,
    maxHp: 215,
    transformAvailable: true, // Mana Unleashed Mode
    sprite: "",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "ZOLTRAAK",
    specialColor: 0xdfe6e9 // White/Silver Energy
  },
  {
    id: 8,
    key: "optimus",
    name: "Optimus Prime",
    price: 800,
    unlocked: false,
    maxHp: 250,
    transformAvailable: true, // Truck Mode
    sprite: "",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "MISSILE STRIKE",
    specialColor: 0xff6b6b
  },
  {
    id: 9,
    key: "minipekka",
    name: "Mini P.E.K.K.A",
    price: 900,
    unlocked: false,
    maxHp: 230,
    transformAvailable: true, // Rage Mode
    sprite: "",
    frameWidth: 64,
    frameHeight: 64,
    specialName: "PANCAKES",
    specialColor: 0x00aaff
  }
];
