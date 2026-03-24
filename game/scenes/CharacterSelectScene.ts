
import Phaser from 'phaser';
import { GameState } from '../types';

export default class CharacterSelectScene extends Phaser.Scene {
  declare registry: Phaser.Data.DataManager;
  declare cameras: Phaser.Cameras.Scene2D.CameraManager;
  declare sound: Phaser.Sound.NoAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager | Phaser.Sound.WebAudioSoundManager;
  declare add: Phaser.GameObjects.GameObjectFactory;
  declare scene: Phaser.Scenes.ScenePlugin;
  declare tweens: Phaser.Tweens.TweenManager;
  declare cache: Phaser.Cache.CacheManager;
  declare make: Phaser.GameObjects.GameObjectCreator;

  private state!: GameState;
  private charContainer!: Phaser.GameObjects.Container;
  private selectionStep: number = 0; // 0 = P1, 1 = P2
  private headerText!: Phaser.GameObjects.Text;
  private fightBtn!: Phaser.GameObjects.Container;

  constructor() {
    super('CharacterSelectScene');
  }

  create() {
    this.state = this.registry.get('gameState') as GameState;
    const { width, height } = this.cameras.main;
    this.selectionStep = 0;

    // Background
    this.add.image(width / 2, height / 2, 'arena').setAlpha(0.2);
    this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.6);

    // Botão Voltar
    const backBtn = this.add.text(50, 40, '← VOLTAR', { fontSize: '20px', fontStyle: 'bold' })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.scene.start('MenuScene'));

    // Header
    this.headerText = this.add.text(width / 2, 60, '', {
        fontSize: '32px',
        color: '#ffd54a',
        fontStyle: 'bold',
        stroke: '#000',
        strokeThickness: 4
    }).setOrigin(0.5);

    this.charContainer = this.add.container(width / 2, 260);
    
    // Botão de Luta (Escondido até selecionar)
    this.createFightButton();
    
    this.updateUI();
  }

  createFightButton() {
    const { width, height } = this.cameras.main;
    this.fightBtn = this.add.container(width / 2, height - 80).setVisible(false);
    
    const bg = this.add.rectangle(0, 0, 240, 60, 0x27ae60).setStrokeStyle(3, 0xffffff);
    const txt = this.add.text(0, 0, 'LUTAR!', { fontSize: '28px', fontStyle: 'bold' }).setOrigin(0.5);
    
    this.fightBtn.add([bg, txt]);
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setFillStyle(0x2ecc71))
      .on('pointerout', () => bg.setFillStyle(0x27ae60))
      .on('pointerdown', () => {
          if(this.cache.audio.exists('sfx_select')) this.sound.play('sfx_select');
          this.scene.start('BattleScene');
      });
  }

  updateUI() {
      this.headerText.setText(this.getSelectionText());
      this.createCharacterSelector();
      
      // Mostrar botão de lutar se a seleção estiver completa ou for single player
      if (this.state.gameMode === 'single') {
          this.fightBtn.setVisible(true);
      } else {
          this.fightBtn.setVisible(true); 
      }
  }

  getSelectionText(): string {
      if (this.state.gameMode === 'single') return 'ESCOLHA SEU HERÓI';
      return this.selectionStep === 0 ? 'PLAYER 1: ESCOLHA' : 'PLAYER 2: ESCOLHA';
  }

  createCharacterSelector() {
      this.charContainer.removeAll(true);
      const unlockedChars = this.state.characters.filter(c => c.unlocked);
      
      const cardSize = 90;
      const gap = 15;
      const itemsPerRow = 7;
      const totalWidth = (itemsPerRow * cardSize) + ((itemsPerRow - 1) * gap);
      const startX = -(totalWidth / 2) + (cardSize / 2);

      unlockedChars.forEach((char, index) => {
          const col = index % itemsPerRow;
          const row = Math.floor(index / itemsPerRow);
          const x = startX + (col * (cardSize + gap));
          const y = (row * (cardSize + 30));

          const isP1 = this.state.p1CharacterId === char.id;
          const isP2 = this.state.p2CharacterId === char.id && this.state.gameMode === 'local_pvp';
          const isSelected = isP1 || isP2;

          const card = this.add.container(x, y);

          let bgColor = 0x222222;
          let strokeColor = 0x555555;
          if (isP1) { strokeColor = 0x3498db; bgColor = 0x102030; }
          else if (isP2) { strokeColor = 0xe74c3c; bgColor = 0x301010; }

          // GLOW EFFECT
          if (isSelected) {
              const glow = this.add.rectangle(0, 0, cardSize + 12, cardSize + 12, strokeColor)
                  .setAlpha(0.2)
                  .setDepth(-1); 
              
              card.add(glow);

              this.tweens.add({
                  targets: glow,
                  alpha: { from: 0.2, to: 0.5 },
                  scale: { from: 0.95, to: 1.05 },
                  duration: 800,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut'
              });
          }

          const bg = this.add.rectangle(0, 0, cardSize, cardSize, bgColor)
              .setStrokeStyle(isSelected ? 3 : 2, strokeColor);

          // Correctly center the sprite (Mask removed to prevent visibility issues)
          const sprite = this.add.sprite(0, -48, char.key, 0)
              .setScale(1.3);

          const nameTxt = this.add.text(0, cardSize/2 - 12, char.name, {
              fontSize: '12px',
              fontStyle: 'bold',
              color: isSelected ? '#fff' : '#aaa'
          }).setOrigin(0.5);

          card.add([bg, sprite, nameTxt]);

          if (isP1) card.add(this.add.text(0, -cardSize/2 - 15, 'P1', { fontSize: '18px', color: '#3498db', fontStyle: 'bold' }).setOrigin(0.5));
          if (isP2) card.add(this.add.text(0, -cardSize/2 - 15, 'P2', { fontSize: '18px', color: '#e74c3c', fontStyle: 'bold' }).setOrigin(0.5));

          bg.setInteractive({ useHandCursor: true })
             .on('pointerdown', () => this.selectCharacter(char.id))
             .on('pointerover', () => {
                 if (!isSelected) {
                    this.tweens.add({ targets: card, scale: 1.1, duration: 100, ease: 'Sine.easeInOut' });
                    bg.setStrokeStyle(4, 0xffffff); 
                    card.setAlpha(1); 
                    nameTxt.setColor('#fff');
                 }
             })
             .on('pointerout', () => {
                 if (!isSelected) {
                    this.tweens.add({ targets: card, scale: 1.0, duration: 100, ease: 'Sine.easeInOut' });
                    bg.setStrokeStyle(2, strokeColor); 
                    card.setAlpha(0.7); 
                    nameTxt.setColor('#aaa');
                 }
             });

          if (isSelected) {
              this.tweens.add({ targets: card, scale: 1.02, duration: 800, yoyo: true, repeat: -1 });
          } else {
              card.setAlpha(0.7);
          }

          this.charContainer.add(card);
      });
  }

  selectCharacter(id: number) {
    if(this.cache.audio.exists('sfx_select')) this.sound.play('sfx_select');
    if (this.state.gameMode === 'single') {
        this.state.p1CharacterId = id;
    } else {
        if (this.selectionStep === 0) {
            this.state.p1CharacterId = id;
            this.selectionStep = 1;
        } else {
            this.state.p2CharacterId = id;
            this.selectionStep = 0; 
        }
    }
    this.updateUI();
  }
}
