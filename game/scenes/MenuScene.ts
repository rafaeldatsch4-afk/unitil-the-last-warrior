
import Phaser from 'phaser';
import { GameState } from '../types';

export default class MenuScene extends Phaser.Scene {
  declare registry: Phaser.Data.DataManager;
  declare cameras: Phaser.Cameras.Scene2D.CameraManager;
  declare sound: Phaser.Sound.NoAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager | Phaser.Sound.WebAudioSoundManager;
  declare add: Phaser.GameObjects.GameObjectFactory;
  declare scene: Phaser.Scenes.ScenePlugin;
  declare tweens: Phaser.Tweens.TweenManager;
  declare cache: Phaser.Cache.CacheManager;

  private state!: GameState;

  constructor() {
    super('MenuScene');
  }

  create() {
    this.state = this.registry.get('gameState') as GameState;
    const { width, height } = this.cameras.main;
    
    // Unlock Audio Context (Browser Policy)
    this.sound.pauseOnBlur = false;
    
    // Parar música de batalha e iniciar a do menu
    if(this.cache.audio.exists('bgm_battle')) {
         const battleBGM = this.sound.get('bgm_battle');
         if (battleBGM) battleBGM.stop();
    }
    if(this.cache.audio.exists('bgm_menu')) {
         const menuBGM = this.sound.get('bgm_menu');
         if (!menuBGM || !menuBGM.isPlaying) {
             this.sound.play('bgm_menu', { loop: true, volume: 0.5 });
         }
    }

    // Background
    this.add.image(width / 2, height / 2, 'arena').setAlpha(0.3);
    this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.4);

    // Title
    this.add.text(width / 2, 120, 'UNTIL THE LAST WARRIOR', {
      fontSize: '56px',
      color: '#ffd54a',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
      fontFamily: 'Impact'
    }).setOrigin(0.5);

    // Botões Centralizados
    const buttonY = 280;
    const spacing = 80;

    this.createMenuButton(width/2, buttonY, 'COMEÇAR', () => {
        this.resumeAudioContext();
        if(this.cache.audio.exists('sfx_select')) this.sound.play('sfx_select');
        this.scene.start('CharacterSelectScene');
    }, 0xe74c3c);

    this.createMenuButton(width/2, buttonY + spacing, 'LOJA', () => {
        this.resumeAudioContext();
        if(this.cache.audio.exists('sfx_select')) this.sound.play('sfx_select');
        this.scene.start('StoreScene');
    }, 0x3498db);

    this.createMenuButton(width/2, buttonY + spacing * 2, 'CONFIGURAÇÕES', () => {
        this.resumeAudioContext();
        if(this.cache.audio.exists('sfx_select')) this.sound.play('sfx_select');
        this.scene.start('SettingsScene');
    }, 0x95a5a6);
  }

  resumeAudioContext() {
      if (this.sound && this.sound instanceof Phaser.Sound.WebAudioSoundManager && this.sound.context.state === 'suspended') {
          this.sound.context.resume();
      }
  }

  createMenuButton(x: number, y: number, text: string, callback: () => void, color: number) {
      const bg = this.add.rectangle(x, y, 320, 60, 0x1f2940).setStrokeStyle(3, 0x3a4866);
      const txt = this.add.text(x, y, text, { 
          fontSize: '24px', 
          fontStyle: 'bold',
          fontFamily: 'Impact',
          letterSpacing: 2
      }).setOrigin(0.5);
      
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { bg.setFillStyle(color); bg.setScale(1.05); txt.setScale(1.05); })
        .on('pointerout', () => { bg.setFillStyle(0x1f2940); bg.setScale(1); txt.setScale(1); })
        .on('pointerdown', () => {
            this.tweens.add({ targets: [bg, txt], scaleX: 0.9, scaleY: 0.9, yoyo: true, duration: 50, onComplete: callback });
        });
  }
}
