
import Phaser from 'phaser';
import { GameState } from '../types';

export default class StoreScene extends Phaser.Scene {
  declare registry: Phaser.Data.DataManager;
  declare add: Phaser.GameObjects.GameObjectFactory;
  declare sound: Phaser.Sound.NoAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager | Phaser.Sound.WebAudioSoundManager;
  declare scene: Phaser.Scenes.ScenePlugin;
  declare make: Phaser.GameObjects.GameObjectCreator;
  declare input: Phaser.Input.InputPlugin;
  declare time: Phaser.Time.Clock;
  declare tweens: Phaser.Tweens.TweenManager;
  declare events: Phaser.Events.EventEmitter;

  private coinsText!: Phaser.GameObjects.Text;
  private itemContainers: Phaser.GameObjects.Container[] = [];
  
  // Scroll variables
  private listContainer!: Phaser.GameObjects.Container;
  private scrollYPos: number = 0;
  private contentHeight: number = 0;
  private visibleArea = { y: 100, height: 420 }; // Top header is ~100px
  private scrollBarThumb!: Phaser.GameObjects.Rectangle;
  private scrollBarTrack!: Phaser.GameObjects.Rectangle;

  // Input keys
  private keys!: any;

  constructor() {
    super('StoreScene');
  }

  create() {
    const state = this.registry.get('gameState') as GameState;

    this.add.rectangle(480, 270, 960, 540, 0x0c141f);
    
    // --- Static Header ---
    // Back Button (Top Left)
    const backContainer = this.add.container(80, 40);
    const backBtn = this.add.rectangle(0, 0, 100, 40, 0xe74c3c).setStrokeStyle(2, 0xffffff);
    const backTxt = this.add.text(0, 0, 'BACK', { fontSize: '18px', fontStyle: 'bold', fontFamily: 'Arial' }).setOrigin(0.5);
    backContainer.add([backBtn, backTxt]);
    
    backBtn.setInteractive({ useHandCursor: true })
        .on('pointerover', () => backBtn.setFillStyle(0xc0392b))
        .on('pointerout', () => backBtn.setFillStyle(0xe74c3c))
        .on('pointerdown', () => {
            this.sound.play('sfx_select');
            this.scene.start('MenuScene');
        });

    this.add.text(480, 40, 'WARRIOR STORE', { fontSize: '32px', color: '#ffffff', fontStyle: 'bold', fontFamily: 'Arial Black' }).setOrigin(0.5);
    this.coinsText = this.add.text(920, 40, `COINS: ${state.coins}`, { fontSize: '24px', color: '#ffd54a', fontStyle: 'bold' }).setOrigin(1, 0.5);
    
    // Info Text about controls
    this.add.text(480, 85, 'Scroll: W (Up) / A (Down)', { fontSize: '14px', color: '#888888' }).setOrigin(0.5);

    // --- Scrollable Content Setup ---
    this.listContainer = this.add.container(0, this.visibleArea.y);
    
    // Mask logic
    const maskShape = this.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, this.visibleArea.y, 960, this.visibleArea.height);
    const mask = maskShape.createGeometryMask();
    this.listContainer.setMask(mask);

    // Scrollbar UI
    const trackX = 945;
    const trackY = this.visibleArea.y + this.visibleArea.height / 2;
    this.scrollBarTrack = this.add.rectangle(trackX, trackY, 10, this.visibleArea.height, 0x222222).setDepth(10);
    this.scrollBarThumb = this.add.rectangle(trackX, this.visibleArea.y + 40, 10, 80, 0x666666).setDepth(11);
    this.scrollBarThumb.setInteractive({ draggable: true });

    // Scroll Events (Mouse)
    const wheelHandler = (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
        this.updateScroll(deltaY);
    };
    this.input.on('wheel', wheelHandler);

    this.input.setDraggable(this.scrollBarThumb);
    this.input.on('drag', (pointer: any, gameObject: any, dragX: number, dragY: number) => {
        if (gameObject === this.scrollBarThumb) {
            const trackTop = this.visibleArea.y;
            const trackBottom = this.visibleArea.y + this.visibleArea.height;
            const thumbHeight = this.scrollBarThumb.height;
            
            // Clamp Y
            const minY = trackTop + thumbHeight / 2;
            const maxY = trackBottom - thumbHeight / 2;
            const newY = Phaser.Math.Clamp(dragY, minY, maxY);
            
            this.scrollBarThumb.y = newY;
            
            // Map position to scrollY
            const percent = (newY - minY) / (maxY - minY);
            const maxContentScroll = Math.max(0, this.contentHeight - this.visibleArea.height);
            this.scrollYPos = percent * maxContentScroll;
            this.listContainer.y = this.visibleArea.y - this.scrollYPos;
        }
    });

    // Clean up event listeners when scene is shut down
    this.events.on('shutdown', () => {
        this.input.off('wheel', wheelHandler);
    });

    // Keyboard Inputs (W for Up, A for Down)
    if (this.input.keyboard) {
        this.keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.A,
            upAlt: Phaser.Input.Keyboard.KeyCodes.UP,
            downAlt: Phaser.Input.Keyboard.KeyCodes.DOWN
        });
    }

    this.renderItems(state);
  }

  update(time: number, delta: number) {
      if (!this.keys) return;

      const scrollSpeed = 0.5 * delta; // Normalize speed with delta

      if (this.keys.up.isDown || this.keys.upAlt.isDown) {
          // W or UP pressed: Scroll Up (Move content Down to see top)
          this.updateScroll(-scrollSpeed);
      } else if (this.keys.down.isDown || this.keys.downAlt.isDown) {
          // A or DOWN pressed: Scroll Down (Move content Up to see bottom)
          this.updateScroll(scrollSpeed);
      }
  }

  updateScroll(delta: number) {
      const maxScroll = Math.max(0, this.contentHeight - this.visibleArea.height);
      if (maxScroll <= 0) return;

      this.scrollYPos = Phaser.Math.Clamp(this.scrollYPos + delta, 0, maxScroll);
      this.listContainer.y = this.visibleArea.y - this.scrollYPos;
      
      this.updateScrollBarPosition();
  }

  updateScrollBarPosition() {
      const maxScroll = Math.max(0, this.contentHeight - this.visibleArea.height);
      if (maxScroll <= 0) {
          this.scrollBarThumb.setVisible(false);
          return;
      }
      this.scrollBarThumb.setVisible(true);
      
      const percent = this.scrollYPos / maxScroll;
      
      const trackTop = this.visibleArea.y;
      const trackBottom = this.visibleArea.y + this.visibleArea.height;
      const thumbHeight = this.scrollBarThumb.height;
      
      const minY = trackTop + thumbHeight / 2;
      const maxY = trackBottom - thumbHeight / 2;
      
      this.scrollBarThumb.y = minY + percent * (maxY - minY);
  }

  renderItems(state: GameState) {
    this.itemContainers.forEach(c => c.destroy());
    this.itemContainers = [];

    const startY = 80; // Initial offset inside container
    const rowHeight = 180;
    const colWidth = 300;
    const cols = 3;

    state.characters.forEach((char, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        const x = 180 + col * colWidth;
        const y = startY + row * rowHeight;
        
        const container = this.add.container(x, y);
        const bg = this.add.rectangle(0, 0, 280, 140, 0x1a2b45).setStrokeStyle(3, 0x3a4866);
        const sprite = this.add.sprite(-80, 10, char.key).setScale(2);
        const name = this.add.text(40, -30, char.name.toUpperCase(), { fontSize: '24px', fontStyle: 'bold', fontFamily: 'Arial Black' }).setOrigin(0.5);
        
        const special = this.add.text(40, -5, `Special: ${char.specialName}`, { fontSize: '12px', color: '#aaa', fontStyle: 'italic' }).setOrigin(0.5);

        container.add([bg, sprite, name, special]);

        if (char.unlocked) {
            const status = this.add.text(40, 25, 'OWNED', { fontSize: '20px', color: '#00ff00', fontStyle: 'bold' }).setOrigin(0.5);
            container.add(status);
        } else {
            const btnBg = this.add.rectangle(40, 30, 140, 40, 0xd35400);
            const btnTxt = this.add.text(40, 30, `${char.price} G`, { fontSize: '20px', fontStyle: 'bold' }).setOrigin(0.5);
            
            btnBg.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    if (state.coins >= char.price) {
                        this.sound.play('sfx_select');
                        state.coins -= char.price;
                        char.unlocked = true;
                        
                        // Save Game State and show feedback
                        window.UTLW.save(); 
                        this.showSaveIndicator();

                        this.coinsText.setText(`COINS: ${state.coins}`);
                        this.renderItems(state);
                    } else {
                        this.sound.play('sfx_error');
                        btnTxt.setText("NO FUNDS");
                        this.time.delayedCall(1000, () => btnTxt.setText(`${char.price} G`));
                    }
                });
            container.add([btnBg, btnTxt]);
        }
        
        this.listContainer.add(container);
        this.itemContainers.push(container);
    });

    // Calculate total height
    const rows = Math.ceil(state.characters.length / cols);
    this.contentHeight = startY + rows * rowHeight;
    
    this.updateScrollBarPosition();
  }

  showSaveIndicator() {
      const txt = this.add.text(920, 80, 'SAVED!', { fontSize: '16px', color: '#00ff00', fontStyle: 'bold' }).setOrigin(1, 0.5);
      this.tweens.add({
          targets: txt,
          y: 70,
          alpha: 0,
          duration: 1500,
          onComplete: () => txt.destroy()
      });
  }
}