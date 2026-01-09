import Phaser from 'phaser';
import { GameState } from '../types';

export default class SettingsScene extends Phaser.Scene {
  declare registry: Phaser.Data.DataManager;
  declare add: Phaser.GameObjects.GameObjectFactory;
  declare scene: Phaser.Scenes.ScenePlugin;
  declare tweens: Phaser.Tweens.TweenManager;

  constructor() {
    super('SettingsScene');
  }

  create() {
    const state = this.registry.get('gameState') as GameState;

    // Back Button (Top Left)
    const backContainer = this.add.container(80, 40);
    const backBtn = this.add.rectangle(0, 0, 100, 40, 0xe74c3c).setStrokeStyle(2, 0xffffff);
    const backTxt = this.add.text(0, 0, 'BACK', { fontSize: '18px', fontStyle: 'bold', fontFamily: 'Arial' }).setOrigin(0.5);
    backContainer.add([backBtn, backTxt]);
    
    backBtn.setInteractive({ useHandCursor: true })
      .on('pointerover', () => backBtn.setFillStyle(0xc0392b))
      .on('pointerout', () => backBtn.setFillStyle(0xe74c3c))
      .on('pointerdown', () => this.scene.start('MenuScene'));

    // Title
    this.add.text(480, 50, 'SETTINGS', { fontSize: '32px', fontStyle: 'bold' }).setOrigin(0.5);

    // Game Mode Setting
    this.add.text(480, 120, 'GAME MODE', { fontSize: '24px', color: '#aaa' }).setOrigin(0.5);
    
    const modeText = this.add.text(480, 160, state.gameMode === 'single' ? '1 PLAYER (vs AI)' : '2 PLAYERS (PvP)', {
      fontSize: '28px',
      color: '#ffd54a',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    modeText.on('pointerdown', () => {
      state.gameMode = state.gameMode === 'single' ? 'local_pvp' : 'single';
      modeText.setText(state.gameMode === 'single' ? '1 PLAYER (vs AI)' : '2 PLAYERS (PvP)');
      this.tweens.add({ targets: modeText, scaleX: 1.2, scaleY: 1.2, duration: 100, yoyo: true });
    });

    // Controls Help - Updated for P1
    this.add.text(480, 210, 'P1: W(Atk) S(Def/Chrg) D(Spec) A(Trans)', { fontSize: '16px', color: '#ccc' }).setOrigin(0.5);
    this.add.text(480, 240, 'P2: Up(Atk) Rt(Def/Chrg) Dn(Spec) Lt(Trans)', { fontSize: '16px', color: '#ccc' }).setOrigin(0.5);

    // Difficulty Setting
    this.add.text(480, 300, 'DIFFICULTY (AI Only)', { fontSize: '24px', color: '#aaa' }).setOrigin(0.5);

    const difficulties = ['Easy', 'Normal', 'Hard'];
    difficulties.forEach((diff, i) => {
        const isSelected = state.difficulty === i;
        const color = isSelected ? '#ffd54a' : '#ffffff';
        const y = 350 + (i * 50);
        const t = this.add.text(480, y, diff, { fontSize: '24px', color: color }).setOrigin(0.5);
        if (isSelected) this.add.text(380, y, '►', { fontSize: '24px', color: '#ffd54a' }).setOrigin(0.5);

        t.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
             state.difficulty = i;
             this.scene.restart();
         });
    });
  }
}