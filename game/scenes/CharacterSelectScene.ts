
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
          // No PvP, mostrar botão apenas se já tiver passado pelo passo 1 (estiver voltando para P1 ou já escolheu P2)
          // Mas como resetamos selectionStep no create, assumimos que P2 ainda não foi escolhido se step == 1
          // Lógica simplificada: Se P1 e P2 forem diferentes (ou se o usuário confirmou), mostraria.
          // Aqui, mostraremos o botão sempre que for PvP, mas clicar nele deveria garantir que P2 foi setado
          // Para evitar confusão, vamos mostrar o botão apenas quando P2 tiver sido selecionado.
          // Como o selectionStep alterna 0->1->0, se estivermos em 0 E P2 já tiver sido atualizado... é complexo.
          // Melhor abordagem: Mostrar o botão Lutar sempre que for PvP, assumindo os IDs atuais.
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
      
      const cardSize = 110;
      const gap = 20;
      const itemsPerRow = 5;
      const totalWidth = (itemsPerRow * cardSize) + ((itemsPerRow - 1) * gap);
      const startX = -(totalWidth / 2) + (cardSize / 2);

      unlockedChars.forEach((char, index) => {
          const col = index % itemsPerRow;
          const row = Math.floor(index / itemsPerRow);
          const x = startX + (col * (cardSize + gap));
          const y = (row * (cardSize + 40));

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
              const glow = this.add.rectangle(0, 0, cardSize + 16, cardSize + 16, strokeColor)
                  .setAlpha(0.2)
                  .setDepth(-1); // Ensures it sits behind the bg added later
              
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
              .setStrokeStyle(isSelected ? 4 : 2, strokeColor);

          // Mask to keep large sprites contained within the card
          const maskShape = this.make.graphics({});
          maskShape.fillStyle(0xffffff);
          // Absolute position calculation for mask geometry
          const absX = (this.cameras.main.width / 2) + x - (cardSize / 2);
          const absY = 260 + y - (cardSize / 2);
          maskShape.fillRect(absX, absY, cardSize, cardSize);
          const mask = maskShape.createGeometryMask();
          
          // Updated Sprite Positioning for 128px tall sprites
          // Moved Y to +45 (downwards) so the head/chest is visible in the card center.
          const sprite = this.add.sprite(0, 45, char.key, 0)
              .setScale(1.6)
              .setMask(mask); 

          const nameTxt = this.add.text(0, cardSize/2 - 15, char.name, {
              fontSize: '14px',
              fontStyle: 'bold',
              color: isSelected ? '#fff' : '#aaa'
          }).setOrigin(0.5);

          card.add([bg, sprite, nameTxt]);

          if (isP1) card.add(this.add.text(0, -cardSize/2 - 15, 'P1', { fontSize: '18px', color: '#3498db', fontStyle: 'bold' }).setOrigin(0.5));
          if (isP2) card.add(this.add.text(0, -cardSize/2 - 15, 'P2', { fontSize: '18px', color: '#e74c3c', fontStyle: 'bold' }).setOrigin(0.5));

          bg.setInteractive({ useHandCursor: true })
             .on('pointerdown', () => this.selectCharacter(char.id))
             .on('pointerover', () => {
                 // Prevent hover effect if selected to avoid tween conflict
                 if (!isSelected) {
                    this.tweens.add({
                        targets: card,
                        scale: 1.1,
                        duration: 100,
                        ease: 'Sine.easeInOut'
                    });
                    bg.setStrokeStyle(4, 0xffffff); // Highlight border
                    card.setAlpha(1); // Full opacity
                    nameTxt.setColor('#fff');
                 }
             })
             .on('pointerout', () => {
                 // Prevent hover effect if selected
                 if (!isSelected) {
                    this.tweens.add({
                        targets: card,
                        scale: 1.0,
                        duration: 100,
                        ease: 'Sine.easeInOut'
                    });
                    bg.setStrokeStyle(2, strokeColor); // Revert border
                    card.setAlpha(0.7); // Revert opacity
                    nameTxt.setColor('#aaa');
                 }
             });

          if (isSelected) {
              // Subtle breathing for the card itself
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
