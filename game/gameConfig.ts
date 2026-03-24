import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import PreloadScene from './scenes/PreloadScene';
import MenuScene from './scenes/MenuScene';
import CharacterSelectScene from './scenes/CharacterSelectScene';
import BattleScene from './scenes/BattleScene';
import StoreScene from './scenes/StoreScene';
import SettingsScene from './scenes/SettingsScene';
import PauseScene from './scenes/PauseScene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent: 'game-container',
  backgroundColor: '#071026',
  pixelArt: true,
  resolution: window.devicePixelRatio || 1,
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    CharacterSelectScene,
    BattleScene,
    StoreScene,
    SettingsScene,
    PauseScene
  ],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};