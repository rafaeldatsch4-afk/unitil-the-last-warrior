
import Phaser from 'phaser';
import { INITIAL_CHARACTERS } from '../data';
import { GameState } from '../types';

export default class BootScene extends Phaser.Scene {
  declare registry: Phaser.Data.DataManager;
  declare scene: Phaser.Scenes.ScenePlugin;

  constructor() {
    super('BootScene');
  }

  create() {
    // Initialize Global Game State if it doesn't exist
    if (!window.UTLW) {
      console.log('Initializing Game State...');
      
      // Default State
      const defaultState: GameState = {
          coins: 1000,
          difficulty: 1,
          gameMode: 'single',
          selectedCharacterId: 0,
          p1CharacterId: 0,
          p2CharacterId: 1,
          characters: JSON.parse(JSON.stringify(INITIAL_CHARACTERS)) // Deep copy
      };

      // Attempt to load from LocalStorage
      try {
        const savedData = localStorage.getItem('utlw_save_v1');
        if (savedData) {
          const parsed = JSON.parse(savedData);
          console.log('Found save data:', parsed);
          
          // Restore coins
          if (typeof parsed.coins === 'number') defaultState.coins = parsed.coins;
          
          // Restore unlocked characters
          if (Array.isArray(parsed.characters)) {
            parsed.characters.forEach((savedChar: any) => {
              const match = defaultState.characters.find(c => c.id === savedChar.id);
              if (match && savedChar.unlocked) {
                match.unlocked = true;
                console.log(`Restored unlocked char: ${match.name}`);
              }
            });
          }
        }
      } catch (e) {
        console.error('Failed to load save data:', e);
      }

      // Set Global Object with Save Method
      window.UTLW = {
        state: defaultState,
        save: () => {
          try {
            const dataToSave = {
              coins: window.UTLW.state.coins,
              characters: window.UTLW.state.characters.map(c => ({ id: c.id, unlocked: c.unlocked }))
            };
            localStorage.setItem('utlw_save_v1', JSON.stringify(dataToSave));
            console.log('Game Saved Successfully');
          } catch (e) {
            console.error('Failed to save game:', e);
          }
        }
      };
    }

    // Ensure registry is synced
    this.registry.set('gameState', window.UTLW.state);

    this.scene.start('PreloadScene');
  }
}