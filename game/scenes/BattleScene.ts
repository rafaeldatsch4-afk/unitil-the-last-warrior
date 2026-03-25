
import Phaser from 'phaser';
import { CharacterData, GameState } from '../types';

export default class BattleScene extends Phaser.Scene {
  declare sound: Phaser.Sound.NoAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager | Phaser.Sound.WebAudioSoundManager;
  declare add: Phaser.GameObjects.GameObjectFactory;
  declare registry: Phaser.Data.DataManager;
  declare time: Phaser.Time.Clock;
  declare input: Phaser.Input.InputPlugin;

  // Mobile Controls Flags
  mobileP1Attack = false;
  mobileP1Defend = false;
  mobileP1Special = false;
  mobileP1Transform = false;
  mobileP1SpecialJustUp = false;
  declare tweens: Phaser.Tweens.TweenManager;
  declare cameras: Phaser.Cameras.Scene2D.CameraManager;
  declare children: Phaser.GameObjects.DisplayList;
  declare scene: Phaser.Scenes.ScenePlugin;
  declare anims: Phaser.Animations.AnimationManager;
  declare cache: Phaser.Cache.CacheManager;
  declare textures: Phaser.Textures.TextureManager;
  declare make: Phaser.GameObjects.GameObjectCreator;
  declare events: Phaser.Events.EventEmitter;

  private player!: Phaser.GameObjects.Sprite;
  private enemy!: Phaser.GameObjects.Sprite;
  
  private playerData!: CharacterData;
  private enemyData!: CharacterData;

  private playerHp: number = 0;
  private enemyHp: number = 0;
  private playerKi: number = 0;
  private enemyKi: number = 0;
  
  private playerTransformLevel: number = 0;
  private enemyTransformLevel: number = 0;
  private playerDefending: boolean = false;
  private enemyDefending: boolean = false;
  
  // Action Flags to prevent spamming
  private p1ActionActive: boolean = false;
  private p2ActionActive: boolean = false;

  private p1Aura!: Phaser.GameObjects.Shape;
  private p2Aura!: Phaser.GameObjects.Shape;

  private p1SpecialHoldTime: number = 0;
  private p2SpecialHoldTime: number = 0;
  private readonly SUPER_THRESHOLD_MS = 1000; // 1 second hold for super
  private p1ChargeIndicator!: Phaser.GameObjects.Arc;
  private p2ChargeIndicator!: Phaser.GameObjects.Arc;

  private p1HpBar!: Phaser.GameObjects.Rectangle;
  private p2HpBar!: Phaser.GameObjects.Rectangle;
  private p1KiBar!: Phaser.GameObjects.Rectangle;
  private p2KiBar!: Phaser.GameObjects.Rectangle;
  private logText!: Phaser.GameObjects.Text;

  private isBattleOver: boolean = false;
  private turnTimer?: Phaser.Time.TimerEvent;
  private regenTimer?: Phaser.Time.TimerEvent;
  private keys!: any;
  private gameState!: GameState;
  
  // Position tuned for 64px tall sprites (scaled 3x)
  // Center Y at 280 ensures feet land around Y=460 (Ground Level)
  private readonly p1StartPos = { x: 200, y: 280 }; 
  private readonly p2StartPos = { x: 760, y: 280 };

  constructor(){ super('BattleScene'); }

  create(){
    this.gameState = this.registry.get('gameState') as GameState;
    this.isBattleOver = false;
    this.p1ActionActive = false;
    this.p2ActionActive = false;
    this.p1SpecialHoldTime = 0;
    this.p2SpecialHoldTime = 0;

    const chars = this.gameState.characters;
    this.playerData = chars.find(c => c.id === this.gameState.p1CharacterId) || chars[0];
    
    if(this.gameState.gameMode === 'local_pvp') {
        this.enemyData = chars.find(c => c.id === this.gameState.p2CharacterId) || chars[1];
    } else {
        const available = chars.filter(c => c.id !== this.playerData.id);
        this.enemyData = available[Phaser.Math.Between(0, available.length-1)] || chars[1];
    }

    // Set arena to back depth
    const arenas = ['arena', 'arena_namek', 'arena_city', 'arena_tournament'];
    const randomArena = Phaser.Utils.Array.GetRandom(arenas);
    this.add.image(480, 270, randomArena).setDisplaySize(960, 540).setTint(0x888888).setDepth(-10);

    if(this.cache.audio.exists('bgm_menu')) this.sound.stopByKey('bgm_menu');
    if(this.cache.audio.exists('bgm_battle')) {
        this.sound.stopByKey('bgm_battle');
        this.sound.play('bgm_battle', { loop: true, volume: 0.4 });
    }

    this.createFighterSprites();
    this.playerHp = this.playerData.maxHp;
    this.enemyHp = this.enemyData.maxHp;
    this.playerKi = 0;
    this.enemyKi = 0;

    this.createUI();
    this.createInputs();

    this.time.delayedCall(1000, () => {
        if (!this.scene.isActive()) return;
        this.log("FIGHT START!");
        if(this.gameState.gameMode === 'single') this.startAILoop();
    });

    // Passive Ki regeneration
    this.regenTimer = this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
            if(this.isBattleOver || !this.scene.isActive()) return;
            this.modifyKi(true, 1);
            this.modifyKi(false, 1);
        }
    });

    // Clean up when scene shuts down
    this.events.on('shutdown', () => {
        if(this.turnTimer) this.turnTimer.remove();
        if(this.regenTimer) this.regenTimer.remove();
        this.sound.stopByKey('bgm_battle');
        this.input.keyboard?.removeAllKeys();
        this.input.keyboard?.removeAllListeners();
    });
  }

  update(time: number, delta: number) {
    if(this.isBattleOver || !this.keys || !this.scene.isActive()) return;

    // --- PLAYER 1 CONTROLS ---
    if (!this.p1ActionActive) {
        // Defend / Charge
        if (this.keys.p1_defend.isDown || this.mobileP1Defend) {
            this.playerDefending = true;
            this.performContinuousCharge(true, delta);
        } else {
            this.playerDefending = false;
            this.stopContinuousCharge(true);
            
            // Attack
            if(Phaser.Input.Keyboard.JustDown(this.keys.p1_attack) || this.mobileP1Attack) {
                this.performAttack(true);
                this.mobileP1Attack = false; // Reset flag
            }
            // Transform
            else if(Phaser.Input.Keyboard.JustDown(this.keys.p1_transform) || this.mobileP1Transform) {
                this.performTransform(true);
                this.mobileP1Transform = false; // Reset flag
            }
            
            // Special
            if (this.keys.p1_special.isDown || this.mobileP1Special) {
                this.p1SpecialHoldTime += delta;
                this.updateChargeIndicator(true, this.p1SpecialHoldTime);
            }
            if (Phaser.Input.Keyboard.JustUp(this.keys.p1_special) || this.mobileP1SpecialJustUp) {
                this.performSpecial(true, this.p1SpecialHoldTime >= this.SUPER_THRESHOLD_MS);
                this.p1SpecialHoldTime = 0;
                this.clearChargeIndicator(true);
                this.mobileP1SpecialJustUp = false; // Reset flag
            }
        }
    }

    // --- PLAYER 2 CONTROLS (Local PvP) ---
    if(this.gameState.gameMode === 'local_pvp' && !this.p2ActionActive) {
        if (this.keys.p2_defend.isDown) {
            this.enemyDefending = true;
            this.performContinuousCharge(false, delta);
        } else {
            this.enemyDefending = false;
            this.stopContinuousCharge(false);

            if(Phaser.Input.Keyboard.JustDown(this.keys.p2_attack)) this.performAttack(false);
            else if(Phaser.Input.Keyboard.JustDown(this.keys.p2_transform)) this.performTransform(false);

            if (this.keys.p2_special.isDown) {
                this.p2SpecialHoldTime += delta;
                this.updateChargeIndicator(false, this.p2SpecialHoldTime);
            }
            if (Phaser.Input.Keyboard.JustUp(this.keys.p2_special)) {
                this.performSpecial(false, this.p2SpecialHoldTime >= this.SUPER_THRESHOLD_MS);
                this.p2SpecialHoldTime = 0;
                this.clearChargeIndicator(false);
            }
        }
    }
  }

  setActionState(isPlayer: boolean, isActive: boolean) {
      if (isPlayer) this.p1ActionActive = isActive;
      else this.p2ActionActive = isActive;
  }

  performContinuousCharge(isPlayer: boolean, delta: number) {
      if(this.isBattleOver) return;
      const chargeRate = 0.03 * delta; // Adjusted for delta
      this.modifyKi(isPlayer, chargeRate); 
      const aura = isPlayer ? this.p1Aura : this.p2Aura;
      if(aura && aura.active) {
          aura.setVisible(true);
          aura.setScale(1 + Math.sin(this.time.now * 0.02) * 0.2);
          aura.setAlpha(0.6);
      }
  }

  stopContinuousCharge(isPlayer: boolean) {
      const aura = isPlayer ? this.p1Aura : this.p2Aura;
      if(aura && aura.active) aura.setVisible(false);
  }

  updateChargeIndicator(isPlayer: boolean, timer: number) {
      const sprite = isPlayer ? this.player : this.enemy;
      const indicator = isPlayer ? this.p1ChargeIndicator : this.p2ChargeIndicator;

      // Safety check if sprite is destroyed
      if (!sprite || !sprite.active) return;

      if (!indicator || !indicator.scene) {
          const obj = this.add.arc(sprite.x, sprite.y - 60, 15, 0, 360, false, 0x00ffff, 0.5);
          if (isPlayer) this.p1ChargeIndicator = obj;
          else this.p2ChargeIndicator = obj;
      }
      
      const ind = isPlayer ? this.p1ChargeIndicator : this.p2ChargeIndicator;
      ind.setPosition(sprite.x, sprite.y - 60).setVisible(true);
      const progress = Math.min(timer / this.SUPER_THRESHOLD_MS, 1);
      
      // Visual indicator logic
      ind.setStartAngle(Phaser.Math.DegToRad(-90));
      ind.setEndAngle(Phaser.Math.DegToRad(-90 + (360 * progress)));
      
      if (progress >= 1) { 
          ind.setFillStyle(0xff0000, 0.8); 
          ind.setScale(1 + Math.sin(this.time.now * 0.02) * 0.2); 
      } else { 
          ind.setFillStyle(0x00ffff, 0.5); 
          ind.setScale(1); 
      }
  }

  clearChargeIndicator(isPlayer: boolean) {
      const ind = isPlayer ? this.p1ChargeIndicator : this.p2ChargeIndicator;
      if (ind && ind.scene) ind.setVisible(false);
  }

  createFighterSprites() {
      // Player 1
      this.player = this.add.sprite(this.p1StartPos.x, this.p1StartPos.y, this.playerData.key)
          .setScale(3) // Scaled down from 4 to fit screen better (Texture height 128 * 3 = 384px)
          .setDepth(1); 
      this.createAnimsFor(this.playerData.key);
      this.player.play(`${this.playerData.key}_idle`, true);
      
      // Shadows (offset +180 relative to sprite center Y to land at Y=460)
      this.add.ellipse(this.p1StartPos.x, this.p1StartPos.y + 180, 100, 30, 0x000000, 0.5).setDepth(0);
      
      // FIX: Moved Aura down to +80 to center on body/chest (was +0, top of head)
      this.p1Aura = this.add.circle(this.p1StartPos.x, this.p1StartPos.y + 80, 50, 0x3498db, 0.5).setVisible(false).setDepth(0);

      // Player 2
      this.enemy = this.add.sprite(this.p2StartPos.x, this.p2StartPos.y, this.enemyData.key)
          .setScale(3)
          .setFlipX(true)
          .setDepth(1);
      this.createAnimsFor(this.enemyData.key);
      this.enemy.play(`${this.enemyData.key}_idle`, true);
      this.add.ellipse(this.p2StartPos.x, this.p2StartPos.y + 180, 100, 30, 0x000000, 0.5).setDepth(0);
      this.p2Aura = this.add.circle(this.p2StartPos.x, this.p2StartPos.y + 80, 50, 0xe74c3c, 0.5).setVisible(false).setDepth(0);
  }

  createAnimsFor(key: string) {
      const createAnim = (animKey: string, texture: string) => {
          if(!this.textures.exists(texture)) return;
          if(!this.anims.exists(animKey)) {
             this.anims.create({
                  key: animKey,
                  frames: this.anims.generateFrameNumbers(texture, { 
                      start: 0, 
                      end: 3
                  }),
                  frameRate: 6,
                  repeat: -1
              });
          }
      };
      createAnim(`${key}_idle`, key);
      createAnim(`${key}_ssj_idle`, `${key}_ssj`);
      if (key === 'goku' || key === 'vegeta' || key === 'naruto') {
          createAnim(`${key}_ui_idle`, `${key}_ui`);
      }
  }

  createInputs() {
      if(!this.input.keyboard) return;
      
      // Clean up old keys if any (defensive)
      this.input.keyboard.removeAllKeys();

      this.keys = this.input.keyboard.addKeys({
          p1_attack: Phaser.Input.Keyboard.KeyCodes.W,
          p1_defend: Phaser.Input.Keyboard.KeyCodes.S,
          p1_special: Phaser.Input.Keyboard.KeyCodes.D,
          p1_transform: Phaser.Input.Keyboard.KeyCodes.A,
          p2_attack: Phaser.Input.Keyboard.KeyCodes.UP,
          p2_defend: Phaser.Input.Keyboard.KeyCodes.RIGHT,
          p2_special: Phaser.Input.Keyboard.KeyCodes.DOWN, 
          p2_transform: Phaser.Input.Keyboard.KeyCodes.LEFT,
          pause: Phaser.Input.Keyboard.KeyCodes.ESC
      });

      // Pause handler
      this.input.keyboard.on('keydown-ESC', () => {
          if (!this.isBattleOver) {
              this.scene.pause();
              this.scene.launch('PauseScene');
          }
      });
  }

  createUI() {
      this.add.rectangle(150, 50, 250, 20, 0x333333).setDepth(10); 
      this.add.rectangle(150, 75, 250, 10, 0x333333).setDepth(10); 
      this.add.rectangle(810, 50, 250, 20, 0x333333).setDepth(10); 
      this.add.rectangle(810, 75, 250, 10, 0x333333).setDepth(10); 

      this.p1HpBar = this.add.rectangle(25, 50, 250, 20, 0x2ecc71).setOrigin(0, 0.5).setDepth(11);
      this.p1KiBar = this.add.rectangle(25, 75, 0, 10, 0x3498db).setOrigin(0, 0.5).setDepth(11);
      this.p2HpBar = this.add.rectangle(685, 50, 250, 20, 0xe74c3c).setOrigin(0, 0.5).setDepth(11);
      this.p2KiBar = this.add.rectangle(685, 75, 0, 10, 0xf1c40f).setOrigin(0, 0.5).setDepth(11);

      this.add.text(25, 25, this.playerData.name, { fontSize: '20px', fontStyle: 'bold' }).setDepth(12);
      this.add.text(935, 25, this.enemyData.name, { fontSize: '20px', fontStyle: 'bold' }).setOrigin(1, 0).setDepth(12);
      this.logText = this.add.text(480, 100, '', { fontSize: '24px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5).setDepth(12);
      
      this.createMobileControls();
  }

  createMobileControls() {
      // Always show on mobile devices or touch screens
      const isTouch = this.sys.game.device.input.touch || window.innerWidth < 800;
      if (!isTouch) return;

      const size = 35;
      const alpha = 0.5;

      const createBtn = (x: number, y: number, text: string, color: number, onDown: () => void, onUp?: () => void) => {
          const btn = this.add.circle(x, y, size, color, alpha).setInteractive().setDepth(100);
          this.add.text(x, y, text, { fontSize: '18px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(101);
          
          btn.on('pointerdown', () => {
              btn.setAlpha(0.8);
              onDown();
          });
          
          const release = () => {
              btn.setAlpha(alpha);
              if (onUp) onUp();
          };
          
          btn.on('pointerup', release);
          btn.on('pointerout', release);
      };

      // Left side (Movement/Defense)
      createBtn(100, 450, 'DEF', 0x3498db, () => { this.mobileP1Defend = true; }, () => { this.mobileP1Defend = false; });
      createBtn(100, 350, 'TRN', 0x9b59b6, () => { this.mobileP1Transform = true; });

      // Right side (Attacks)
      createBtn(860, 450, 'ATK', 0xe74c3c, () => { this.mobileP1Attack = true; });
      createBtn(860, 350, 'SPC', 0xf1c40f, 
          () => { this.mobileP1Special = true; }, 
          () => { this.mobileP1Special = false; this.mobileP1SpecialJustUp = true; }
      );
  }

  performAttack(isPlayer: boolean) {
      if(this.isBattleOver) return;
      const attacker = isPlayer ? this.player : this.enemy;
      const target = isPlayer ? this.enemy : this.player;
      const startX = isPlayer ? this.p1StartPos.x : this.p2StartPos.x;
      const startY = isPlayer ? this.p1StartPos.y : this.p2StartPos.y;
      const transLevel = isPlayer ? this.playerTransformLevel : this.enemyTransformLevel;

      this.setActionState(isPlayer, true);

      // 1. Windup (Hop Back & Rotate)
      const windupDist = isPlayer ? -40 : 40;
      const rotDir = isPlayer ? -0.2 : 0.2;

      this.tweens.add({
          targets: attacker,
          x: startX + windupDist,
          y: startY - 10,
          rotation: rotDir,
          scaleX: 2.8,
          scaleY: 3.2,
          duration: 100,
          ease: 'Power1',
          onComplete: () => {
              if(!this.scene.isActive()) return;
              
              // Dash Trail Effect
              const trailTimer = this.time.addEvent({
                  delay: 20,
                  callback: () => {
                      if (!this.scene.isActive() || !attacker.active) return;
                      const ghost = this.add.sprite(attacker.x, attacker.y, attacker.texture.key, attacker.frame.name)
                          .setScale(attacker.scaleX, attacker.scaleY)
                          .setRotation(attacker.rotation)
                          .setFlipX(attacker.flipX)
                          .setTint(0x00ffff)
                          .setAlpha(0.5)
                          .setDepth(0);
                      this.tweens.add({
                          targets: ghost,
                          alpha: 0,
                          scaleX: 1.5,
                          scaleY: 1.5,
                          duration: 200,
                          onComplete: () => ghost.destroy()
                      });
                  },
                  repeat: 7
              });

              // 2. Lunge Forward
              this.tweens.add({
                  targets: attacker,
                  x: target.x + (isPlayer ? -60 : 60),
                  y: startY,
                  rotation: -rotDir * 1.5,
                  scaleX: 3.2,
                  scaleY: 2.8,
                  duration: 150,
                  ease: 'Expo.easeIn',
                  onComplete: () => {
                     trailTimer.remove();
                     if (!this.scene.isActive()) return;
                     
                     // 3. Impact
                     if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack');
                     
                     const baseDamage = 10;
                     const damage = Math.floor(baseDamage * this.getDamageMultiplier(transLevel));
                     
                     this.takeDamage(!isPlayer, damage); 
                     this.modifyKi(isPlayer, 5);
                     
                     // Screen Shake & Flash
                     this.cameras.main.shake(150, 0.02);
                     
                     // Visual Impact
                     this.createImpactEffect(target.x, target.y - 20, 0xffffff);

                     // 4. Return
                     this.tweens.add({
                         targets: attacker,
                         x: startX,
                         y: startY,
                         rotation: 0,
                         scaleX: 3,
                         scaleY: 3,
                         duration: 250,
                         ease: 'Power2',
                         delay: 50,
                         onComplete: () => {
                             if(this.scene.isActive()) this.setActionState(isPlayer, false);
                         }
                     });
                  }
              });
          }
      });
  }

  performCharge(isPlayer: boolean) {
      if (isPlayer && this.p1ActionActive) return;
      if (!isPlayer && this.p2ActionActive) return;
      if (this.isBattleOver) return;

      this.setActionState(isPlayer, true);
      this.modifyKi(isPlayer, 25); 
      const sprite = isPlayer ? this.player : this.enemy;
      
      // FIX: Moved charge aura down to +60 (Chest level)
      const aura = this.add.circle(sprite.x, sprite.y + 60, 10, isPlayer ? 0x3498db : 0xe74c3c, 0.6);
      this.children.moveBelow(aura, sprite); 
      
      this.tweens.add({ 
          targets: aura, 
          scale: 8, 
          alpha: 0, 
          duration: 600, 
          onComplete: () => {
              if (this.scene.isActive()) {
                  aura.destroy();
                  this.setActionState(isPlayer, false);
              }
          }
      });
  }

  performTransform(isPlayer: boolean) {
      if (this.isBattleOver) return;
      const data = isPlayer ? this.playerData : this.enemyData;
      const ki = isPlayer ? this.playerKi : this.enemyKi;
      const currentLevel = isPlayer ? this.playerTransformLevel : this.enemyTransformLevel;
      const sprite = isPlayer ? this.player : this.enemy;

      // Check max transformation level
      let maxLevel = 1;
      if (data.key === 'goku' || data.key === 'vegeta' || data.key === 'naruto') maxLevel = 2; // Goku, Vegeta, Naruto have 2 transformations

      if(!data.transformAvailable || currentLevel >= maxLevel || ki < 100) return;

      this.setActionState(isPlayer, true);
      this.modifyKi(isPlayer, -100);
      
      const nextLevel = currentLevel + 1;
      if(isPlayer) this.playerTransformLevel = nextLevel; else this.enemyTransformLevel = nextLevel;
      
      const isUI = data.key === 'goku' && nextLevel === 2;
      const isUE = data.key === 'vegeta' && nextLevel === 2;
      const isSageMode = data.key === 'naruto' && nextLevel === 1;
      const isKuramaMode = data.key === 'naruto' && nextLevel === 2;
      
      let auraColor = 0xffd700;
      let ringColor = 0xffff00;
      let transformText = `${data.name} TRANSFORMED!`;

      if (isUI) {
          auraColor = 0xffffff;
          ringColor = 0x00ffff;
          transformText = "ULTRA INSTINCT!";
      } else if (isUE) {
          auraColor = 0x9b59b6; // Purple
          ringColor = 0xff00ff; // Magenta
          transformText = "ULTRA EGO!";
      } else if (data.key === 'gohan') {
          auraColor = 0x8a2be2; // Violet
          ringColor = 0xff00ff; // Magenta
          transformText = "BEAST FORM!";
      } else if (data.key === 'frieza') {
          auraColor = 0xffd700; // Gold
          ringColor = 0xffffff; // White
          transformText = "GOLDEN FRIEZA!";
      } else if (data.key === 'piccolo') {
          auraColor = 0xff8800; // Orange
          ringColor = 0xffaa00; // Light Orange
          transformText = "ORANGE PICCOLO!";
      } else if (data.key === 'cell') {
          auraColor = 0x00ff00; // Green
          ringColor = 0x00aa00; // Dark Green
          transformText = "PERFECT CELL!";
      } else if (data.key === 'optimus') {
          auraColor = 0x3498db; // Blue
          ringColor = 0x2980b9; // Dark Blue
          transformText = "TRUCK MODE!";
      } else if (data.key === 'minipekka') {
          auraColor = 0xff0000; // Red
          ringColor = 0xaa0000; // Dark Red
          transformText = "RAGE MODE!";
      } else if (data.key === 'cyberninja') {
          auraColor = 0x00eaff; // Cyan
          ringColor = 0x0088ff; // Blue
          transformText = "OVERDRIVE!";
      } else if (isSageMode) {
          auraColor = 0xffaa00; // Orange/Yellow
          ringColor = 0xff4400; // Reddish orange
          transformText = "SAGE MODE!";
      } else if (isKuramaMode) {
          auraColor = 0xffff00; // Bright Yellow
          ringColor = 0xffaa00; // Orange
          transformText = "KURAMA LINK MODE!";
      }

      // FX: Massive pillar of light
      const pillar = this.add.rectangle(sprite.x, sprite.y, 60, 1000, auraColor).setAlpha(0).setDepth(2);
      
      this.tweens.add({
          targets: sprite,
          y: sprite.y - 50,
          duration: 400,
          yoyo: true,
          onYoyo: () => {
              if (!this.scene.isActive()) return;
              
              let texKey = `${data.key}_ssj`;
              if (isUI || isUE || isKuramaMode) texKey = `${data.key}_ui`;

              if(this.textures.exists(texKey)) {
                  sprite.setTexture(texKey);
                  if(this.anims.exists(`${texKey}_idle`)) sprite.play(`${texKey}_idle`);
              }
              
              // Big Flash
              this.cameras.main.flash(400, 255, 230, 150, true);
              this.cameras.main.shake(500, 0.03);
              if(this.cache.audio.exists('sfx_transform')) this.sound.play('sfx_transform');

              // Pillar Animation
              pillar.setAlpha(1).setScale(0, 1);
              this.tweens.add({
                  targets: pillar,
                  scaleX: 2,
                  alpha: 0,
                  duration: 600,
                  onComplete: () => { if(this.scene.isActive()) pillar.destroy(); }
              });

              // Shockwave Ring
              const ring = this.add.circle(sprite.x, sprite.y, 20, auraColor, 0)
                  .setStrokeStyle(4, ringColor)
                  .setDepth(2);
              this.tweens.add({
                  targets: ring,
                  scale: 15,
                  alpha: { start: 1, end: 0 },
                  duration: 500,
                  onComplete: () => { if(this.scene.isActive()) ring.destroy(); }
              });

              // Update continuous charge aura color
              const chargeAura = isPlayer ? this.p1Aura : this.p2Aura;
              if (chargeAura && chargeAura.active) {
                  (chargeAura as Phaser.GameObjects.Shape).setFillStyle(auraColor, 0.5);
              }

              // Extra particles for specific transformations
              if (data.key === 'gohan' || isUI || isUE) {
                  for (let i = 0; i < 10; i++) {
                      const spark = this.add.circle(sprite.x + Phaser.Math.Between(-30, 30), sprite.y + Phaser.Math.Between(-50, 50), 3, ringColor).setDepth(3);
                      this.tweens.add({
                          targets: spark,
                          y: spark.y - Phaser.Math.Between(50, 150),
                          alpha: 0,
                          duration: Phaser.Math.Between(400, 800),
                          onComplete: () => spark.destroy()
                      });
                  }
              }
          },
          onComplete: () => {
              if(this.scene.isActive()) this.setActionState(isPlayer, false);
          }
      });
      this.log(transformText);
  }

  // --- ANIMATION SEQUENCE (FIXED: NO MOVEMENT) ---
  animateCastSequence(attacker: Phaser.GameObjects.Sprite, isPlayer: boolean, tintColor: number, onFireCallback: () => void) {
      attacker.anims.pause();

      // FIXED: Removed x movement (targets: attacker, x: ...)
      // We only scale to show effort/charging. This prevents the beam from detaching or spawning behind.
      
      const rotDir = isPlayer ? -0.15 : 0.15;

      // 1. Squash/Stretch (Charge)
      this.tweens.add({
          targets: attacker,
          scaleX: 3.5, // Stretch wide
          scaleY: 2.5, // Squash down
          rotation: rotDir,
          tint: tintColor,
          duration: 200, 
          ease: 'Quad.easeOut',
          onComplete: () => {
              if(!this.scene.isActive()) return;
              attacker.setTint(0xffffff); 
              
              // Flash screen slightly to indicate power
              this.cameras.main.flash(200, 255, 255, 255, false);
              
              // Snap forward
              this.tweens.add({
                  targets: attacker,
                  rotation: -rotDir,
                  scaleX: 2.8,
                  scaleY: 3.2,
                  duration: 100,
                  ease: 'Power2'
              });

              // FIRE IMMEDIATELY
              onFireCallback();
              
              // 2. HOLD (Stay in pose)
              this.time.delayedCall(500, () => {
                  if(!this.scene.isActive()) return;
                  
                  // 3. Recovery (Return to Normal)
                  this.tweens.add({
                      targets: attacker,
                      scaleX: 3,
                      scaleY: 3,
                      rotation: 0,
                      duration: 200,
                      ease: 'Quad.easeOut',
                      onComplete: () => {
                          if(!this.scene.isActive()) return;
                          attacker.clearTint();
                          attacker.anims.resume();
                      }
                  });
              });
          }
      });
  }

  performSpecial(isPlayer: boolean, isSuper: boolean) {
      if(this.isBattleOver) return;
      const ki = isPlayer ? this.playerKi : this.enemyKi;
      const data = isPlayer ? this.playerData : this.enemyData;
      const cost = isSuper ? 100 : 50;
      const sprite = isPlayer ? this.player : this.enemy;

      if(ki < cost) { 
          if(isPlayer) this.log(`Need ${cost} Ki!`); 
          return; 
      }

      this.setActionState(isPlayer, true);
      this.modifyKi(isPlayer, -cost);

      if (data.key === 'minipekka') {
          if (isSuper) this.specialMegaPancake(isPlayer);
          else this.specialPancake(isPlayer, false);
      } else {
          this.animateCastSequence(sprite, isPlayer, data.specialColor, () => {
              switch(data.key) {
                  case 'goku':
                      if (isSuper) this.specialGenkidama(isPlayer);
                      else this.specialBeam(isPlayer, false, 0x00ffff, true, false, 'kamehameha');
                      break;
                  case 'vegeta': 
                      if (isSuper) this.specialFinalFlash(isPlayer);
                      else this.specialBeam(isPlayer, false, 0x9b59b6, true, true, 'galick'); 
                      break; 
                  case 'gohan': 
                      if (isSuper) this.specialFatherSonKamehameha(isPlayer);
                      else this.specialBeam(isPlayer, false, 0xffff00, true, false, 'masenko'); 
                      break; 
                  case 'piccolo': 
                      if (isSuper) this.specialHellzoneGrenade(isPlayer);
                      else this.specialMakanko(isPlayer, false); 
                      break;
                  case 'frieza': 
                      if (isSuper) this.specialDeathBall(isPlayer);
                      else this.specialDeathBeam(isPlayer, false); 
                      break;
                  case 'cell': 
                      if (isSuper) this.specialSolarKamehameha(isPlayer);
                      else this.specialBeam(isPlayer, false, 0x00ff00, true, false, 'kamehameha'); 
                      break;
                  case 'leonardo': 
                      if (isSuper) this.specialNinjaBarrage(isPlayer);
                      else this.specialSlash(isPlayer, false); 
                      break;
                  case 'frieren': 
                      if (isSuper) this.specialBlackHole(isPlayer);
                      else this.specialZoltraak(isPlayer, false); 
                      break;
                  case 'optimus': 
                      if (isSuper) this.specialMatrixBlast(isPlayer);
                      else this.specialMissiles(isPlayer, false); 
                      break;
                  case 'cyberninja': 
                      if (isSuper) this.specialCyberOverdrive(isPlayer);
                      else this.specialPlasmaDash(isPlayer, false); 
                      break;
                  case 'chapolim':
                      if (isSuper) this.specialAerolitos(isPlayer);
                      else this.specialChipote(isPlayer);
                      break;
                  case 'naruto':
                      if (isSuper) this.specialRasenshuriken(isPlayer);
                      else this.specialRasengan(isPlayer, false);
                      break;
                  default: 
                      this.specialBeam(isPlayer, isSuper, data.specialColor, false, false, 'generic'); 
                      break;
              }
          });
      }
  }

  private onSpecialComplete(isPlayer: boolean) {
      this.time.delayedCall(600, () => {
          if(this.scene.isActive()) this.setActionState(isPlayer, false);
      });
  }

  // Helper to calculate damage multiplier based on transformation level
  private getDamageMultiplier(transLevel: number): number {
      if (transLevel === 1) return 1.25; // 25% stronger
      if (transLevel === 2) return 1.50; // 50% stronger
      return 1.0;
  }

  // Helper to get EXACT hand position based on sprite flipping
  private getHandPosition(isPlayer: boolean): {x: number, y: number} {
      const sprite = isPlayer ? this.player : this.enemy;
      const xOffset = isPlayer ? 35 : -35; 
      const yOffset = 50; 
      return { x: sprite.x + xOffset, y: sprite.y + yOffset };
  }

  // =========================================================================
  // REMASTERED SPECIAL ATTACKS (VISUALLY UPGRADED FOR ALL)
  // =========================================================================

  // 1. BEAM ENGINE (KAMEHAMEHA, GALICK GUN, MASENKO)
  private specialBeam(isP: boolean, isS: boolean, col: number, hasInner: boolean, vibrate: boolean, type: string) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      if(!attacker.active || !target.active) { this.setActionState(isP, false); return; }

      const baseDmg = isS ? 60 : 35;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));

      const size = isS ? 2.5 : 1.8; 
      
      const hand = this.getHandPosition(isP);
      const endX = target.x;
      const distance = Math.abs(endX - hand.x);

      // Muzzle Flash (Charge)
      const muzzle = this.add.circle(hand.x, hand.y, 5, col).setDepth(7).setAlpha(0.8);
      // Flash Tween
      this.tweens.add({ targets: muzzle, scale: 6, alpha: 0.2, duration: 150, yoyo: true, repeat: 1 });
      // Shake during charge
      this.cameras.main.shake(100, 0.01);

      this.log(isS ? "SUPER ATTACK!" : type.toUpperCase() + "!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // The Beam Structure
      const originX = 0; 
      
      // Main Color Beam
      const beamMain = this.add.rectangle(hand.x, hand.y, 0, 24 * size, col).setOrigin(originX, 0.5).setDepth(5).setAlpha(0.9);
      beamMain.scaleX = isP ? 1 : -1;
      
      // Inner Core (White/Bright)
      const beamCore = this.add.rectangle(hand.x, hand.y, 0, 12 * size, 0xffffff).setOrigin(originX, 0.5).setDepth(6);
      beamCore.scaleX = isP ? 1 : -1;
      
      // Beam Head/Tip
      const beamHead = this.add.circle(hand.x, hand.y, 20 * size, 0xffffff).setDepth(6); 
      
      // Particles Emitter for Beam
      const particles = this.add.particles(0, 0, 'particle', {
          speed: 100,
          scale: { start: 0.5 * size, end: 0 },
          blendMode: 'ADD',
          lifespan: 200,
          tint: col
      }).setDepth(4);

      // Animation
      this.tweens.add({
          targets: [beamMain, beamCore],
          width: distance, 
          duration: type === 'masenko' ? 150 : 250, // Masenko is faster
          ease: 'Linear',
          onUpdate: () => {
              if(!this.scene.isActive()) return;
              
              // Intense Vibration for Galick Gun, steady for Kamehameha
              const shakeAmt = vibrate ? 4 : 1;
              const jitterY = Phaser.Math.Between(-shakeAmt, shakeAmt);

              beamMain.setPosition(hand.x, hand.y + jitterY);
              beamCore.setPosition(hand.x, hand.y + jitterY/2); // Core vibrates less
              
              // Tip Position
              const tipX = isP ? (hand.x + beamMain.width) : (hand.x - beamMain.width);
              beamHead.setPosition(tipX, hand.y + jitterY);
              muzzle.setPosition(hand.x, hand.y);

              // Particle Emitter follows tip
              particles.setPosition(tipX, hand.y + jitterY);
          },
          onComplete: () => {
              if(!this.scene.isActive()) return;
              
              this.createImpactEffect(endX, hand.y, col);
              this.takeDamage(!isP, dmg);
              this.cameras.main.shake(300, 0.04);
              particles.stop();

              // Fade Out
              this.tweens.add({
                  targets: [beamMain, beamCore, beamHead, muzzle].filter(Boolean),
                  alpha: 0,
                  scaleY: 0,
                  duration: 250,
                  onComplete: () => {
                      beamMain.destroy(); beamCore.destroy(); beamHead.destroy(); muzzle.destroy(); particles.destroy();
                      this.onSpecialComplete(isP);
                  }
              });
          }
      });
  }

  // 2. MAKANKOSAPPO (DOUBLE HELIX REMASTER)
  private specialMakanko(isP: boolean, isS: boolean) {
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const baseDmg = isS ? 70 : 45;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));
      const hand = this.getHandPosition(isP);
      const endX = target.x;
      const distance = Math.abs(endX - hand.x);

      this.log("MAKANKOSAPPO!");
      
      const originX = 0;
      
      // Thicker central beam
      const core = this.add.rectangle(hand.x, hand.y, 0, 10, 0xffff00).setOrigin(originX, 0.5).setDepth(5);
      core.scaleX = isP ? 1 : -1;
      
      // Two separate graphics for the double helix
      const spiral1 = this.add.graphics().setDepth(6);
      const spiral2 = this.add.graphics().setDepth(6);
      
      const muzzle = this.add.circle(hand.x, hand.y, 25, 0xffff00).setDepth(7);
      this.tweens.add({ targets: muzzle, scale: 1.5, alpha: 0, duration: 200, repeat: 1 });

      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');
      
      this.tweens.add({
          targets: core,
          width: distance,
          duration: 300,
          onUpdate: () => {
              if(!this.scene.isActive()) return;
              
              spiral1.clear(); spiral2.clear();
              spiral1.lineStyle(4, 0xffaa00); // Orange tint
              spiral2.lineStyle(4, 0xffd700); // Gold tint
              
              const currentW = core.width;
              
              // Double Helix Math
              const freq = 0.1;
              const amp = 20;
              const speed = this.time.now * 0.02;

              spiral1.beginPath();
              spiral2.beginPath();

              for(let i=0; i<currentW; i+=10) {
                  const angle = (i * freq) + speed;
                  const sx = isP ? hand.x + i : hand.x - i;
                  
                  // Spiral 1 (Sine)
                  const sy1 = hand.y + Math.sin(angle) * amp;
                  if(i===0) spiral1.moveTo(sx, sy1); else spiral1.lineTo(sx, sy1);

                  // Spiral 2 (Cosine / Opposite)
                  const sy2 = hand.y + Math.sin(angle + Math.PI) * amp; // Phase shift PI
                  if(i===0) spiral2.moveTo(sx, sy2); else spiral2.lineTo(sx, sy2);
              }
              spiral1.strokePath();
              spiral2.strokePath();
          },
          onComplete: () => {
              if (!this.scene.isActive()) return;
              this.createImpactEffect(endX, hand.y, 0xffff00);
              this.takeDamage(!isP, dmg);
              this.cameras.main.shake(300, 0.05);
              
              this.tweens.add({ 
                  targets: [core, spiral1, spiral2, muzzle], 
                  alpha: 0, 
                  duration: 200, 
                  onComplete: () => { 
                      if(this.scene.isActive()) {
                        core.destroy(); spiral1.destroy(); spiral2.destroy(); muzzle.destroy();
                        this.onSpecialComplete(isP);
                      }
                  }
              });
          }
      });
  }

  // 3. DEATH BEAM (INSTANT LASER REMASTER)
  private specialDeathBeam(isP: boolean, isS: boolean) {
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const baseDmg = isS ? 50 : 25;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));
      
      const hand = this.getHandPosition(isP);
      const startY = hand.y - 10; 
      const endX = target.x;
      const endY = target.y + 40;

      this.log("DEATH BEAM!");
      
      // Lens Flare at finger
      const flash = this.add.star(hand.x, startY, 4, 10, 20, 0xffffff).setDepth(8);
      this.tweens.add({ targets: flash, scale: 2, rotation: 3.14, duration: 200, alpha: 0 });

      // Solid inner core + Glowing outer line
      const beamOuter = this.add.line(0, 0, hand.x, startY, endX, endY, 0xff00ff)
          .setOrigin(0).setLineWidth(8).setDepth(5).setAlpha(0.6);
      const beamInner = this.add.line(0, 0, hand.x, startY, endX, endY, 0xffffff)
          .setOrigin(0).setLineWidth(3).setDepth(6);
          
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam', { detune: 600 }); 

      // Hit immediately
      this.time.delayedCall(50, () => {
          if (!this.scene.isActive()) return;
          
          // Pinpoint explosion
          const hit = this.add.star(endX, endY, 5, 10, 30, 0xff00ff).setDepth(20);
          this.tweens.add({ targets: hit, scale: 3, alpha: 0, duration: 300 });

          this.takeDamage(!isP, dmg);
          this.cameras.main.flash(50, 255, 200, 255, true);
          
          // Fade out beam (Residual image)
          this.tweens.add({ 
              targets: [beamOuter, beamInner], alpha: 0, lineWidth: 0, duration: 300, 
              onComplete: () => {
                  if(this.scene.isActive()) {
                      beamOuter.destroy(); beamInner.destroy(); flash.destroy();
                      this.onSpecialComplete(isP);
                  }
              }
           });
      });
  }

  // 4. KATANA SLASH (DIMENSIONAL CUT REMASTER)
  private specialSlash(isP: boolean, isS: boolean) {
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const baseDmg = isS ? 55 : 30;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));
      const hand = this.getHandPosition(isP);

      this.log("KATANA SLASH!");
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack');

      // The Slash Graphic
      const slash = this.add.graphics().setDepth(5);
      slash.fillStyle(0x3498db, 1);
      
      // Draw a growing crescent
      if (isP) {
        slash.slice(0, 0, 60, Phaser.Math.DegToRad(-40), Phaser.Math.DegToRad(40), false);
      } else {
        slash.slice(0, 0, 60, Phaser.Math.DegToRad(140), Phaser.Math.DegToRad(220), false);
      }
      slash.fillPath();
      slash.setPosition(hand.x, hand.y);
      slash.setScale(0.1); // Start small

      this.tweens.add({
          targets: slash,
          x: target.x,
          scaleX: 2.0, // Grow huge
          scaleY: 2.0,
          alpha: { start: 1, end: 0 }, // Fade out as it hits
          duration: 250,
          onComplete: () => {
              if(!this.scene.isActive()) return;
              
              // Distortion line at impact
              const cutLine = this.add.rectangle(target.x, target.y, 10, 200, 0xffffff).setRotation(0.5);
              this.tweens.add({ targets: cutLine, scaleX: 0, scaleY: 2, alpha: 0, duration: 200 });
              
              this.createImpactEffect(target.x, hand.y, 0x3498db);
              this.takeDamage(!isP, dmg);
              slash.destroy();
              this.onSpecialComplete(isP);
          }
      });
  }

  // 5. ZOLTRAAK (MASSIVE MAGIC REMASTER)
  private specialZoltraak(isP: boolean, isS: boolean) {
      const hand = this.getHandPosition(isP);
      const circleOffset = isP ? 40 : -40;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const baseDmg = isS ? 80 : 50;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));

      this.log("ZOLTRAAK!");

      // Always 3 Circles for maximum epicness
      const circles: Phaser.GameObjects.Graphics[] = [];
      for(let i=0; i<3; i++) {
        const c = this.add.graphics().setDepth(5);
        c.lineStyle(3, 0xffffff);
        c.strokeCircle(0, 0, 30 + (i*10)); // Concentric sizes
        c.strokeRect(-20 - (i*5), -20 - (i*5), 40 + (i*10), 40 + (i*10));
        c.setPosition(hand.x + circleOffset, hand.y);
        c.setRotation(i * 0.5); // Different start rotations
        circles.push(c);
      }

      // Spin up
      this.tweens.add({
          targets: circles,
          angle: 360,
          scale: 1.2,
          duration: 500,
          onComplete: () => {
              if(!this.scene.isActive()) return;
              circles.forEach(c => c.destroy());
              
              // MASSIVE BEAM "JUDGEMENT" STYLE
              const target = isP ? this.enemy : this.player;
              const beamWidth = 800;
              const originX = 0; // FIX: Added origin direction logic
              
              // Black void beam
              const massiveBeam = this.add.rectangle(hand.x, hand.y, beamWidth, 150, 0x000000)
                  .setOrigin(originX, 0.5) // FIX: Set Origin
                  .setAlpha(0.9)
                  .setDepth(10);
              massiveBeam.scaleX = isP ? 1 : -1;
              // White hot core
              const core = this.add.rectangle(hand.x, hand.y, beamWidth, 60, 0xffffff)
                  .setOrigin(originX, 0.5) // FIX: Set Origin
                  .setDepth(11);
              core.scaleX = isP ? 1 : -1;
              
              this.cameras.main.shake(500, 0.05);
              this.createImpactEffect(target.x, hand.y, 0x000000);
              this.takeDamage(!isP, dmg); // Buffed dmg
              
              this.tweens.add({
                  targets: [massiveBeam, core],
                  scaleY: 0,
                  duration: 400,
                  ease: 'Quad.easeIn',
                  onComplete: () => {
                      massiveBeam.destroy(); core.destroy();
                      this.onSpecialComplete(isP);
                  }
              });
          }
      });
  }

  // 6. MISSILES (SMOKE TRAIL REMASTER)
  private specialMissiles(isP: boolean, isS: boolean) {
      this.log("MISSILE STRIKE!");
      const count = isS ? 8 : 4; // More missiles
      const hand = this.getHandPosition(isP);
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const baseDmg = isS ? 8 : 12;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));

      const fireOne = (delay: number) => {
          this.time.delayedCall(delay, () => {
              if(!this.scene.isActive()) return;
              
              // Missile Graphic
              const m = this.add.rectangle(hand.x, hand.y - 30, 15, 6, 0xffffff).setDepth(5);
              
              // Smoke Particle Emitter
              const smoke = this.add.particles(0,0, 'particle', {
                  follow: m,
                  scale: {start: 0.8, end: 0},
                  lifespan: 400,
                  tint: 0x555555, // Grey smoke
                  frequency: 20
              });

              const targetX = isP ? this.enemy.x : this.player.x;
              const targetY = (isP ? this.enemy.y : this.player.y) + Phaser.Math.Between(0, 100); // Hit various body parts
              
              // High Arc
              const midX = (hand.x + targetX) / 2;
              const midY = hand.y - 250; 

              const curve = new Phaser.Curves.QuadraticBezier(
                  new Phaser.Math.Vector2(hand.x, hand.y - 30),
                  new Phaser.Math.Vector2(midX, midY),
                  new Phaser.Math.Vector2(targetX, targetY)
              );

              let t = { val: 0 };
              this.tweens.add({
                  targets: t,
                  val: 1,
                  duration: 600,
                  onUpdate: () => {
                      const pos = curve.getPoint(t.val);
                      m.setPosition(pos.x, pos.y);
                      m.rotation = curve.getTangent(t.val).angle();
                  },
                  onComplete: () => {
                      if(!this.scene.isActive()) return;
                      m.destroy(); smoke.destroy();
                      this.createImpactEffect(targetX, targetY, 0xff6b6b);
                      this.takeDamage(!isP, dmg); 
                  }
              });
          });
      };

      for(let i=0; i<count; i++) fireOne(i * 80); // Rapid fire
      this.onSpecialComplete(isP);
  }

  // 7. PANCAKE (JUMP ATTACK - Uses specific tweens)
  private specialPancake(isP: boolean, isS: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const startX = isP ? this.p1StartPos.x : this.p2StartPos.x;
      const startY = isP ? this.p1StartPos.y : this.p2StartPos.y;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const baseDmg = isS ? 80 : 50;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));

      this.log("PANCAKES!");
      
      attacker.anims.pause();
      
      // Shadow looming over target
      const shadow = this.add.ellipse(target.x, target.y + 30, 10, 5, 0x000000, 0.5);
      this.tweens.add({ targets: shadow, scaleX: 10, scaleY: 5, duration: 400 });

      this.tweens.add({
          targets: attacker,
          y: startY - 400, // Higher jump
          x: target.x,
          duration: 400,
          ease: 'Cubic.easeOut',
          onComplete: () => {
              if (!this.scene.isActive()) return;
              this.tweens.add({
                  targets: attacker,
                  y: startY,
                  duration: 150, // Faster drop
                  ease: 'Bounce.easeOut', 
                  onComplete: () => {
                      if (!this.scene.isActive()) return;
                      this.cameras.main.shake(300, 0.08); // Big shake
                      
                      // Shockwave Ring
                      const ring = this.add.circle(target.x, startY, 10, 0x00aaff).setStrokeStyle(3, 0xffffff).setDepth(20);
                      this.tweens.add({ targets: ring, scale: 10, alpha: 0, duration: 300 });

                      this.createImpactEffect(target.x, startY, 0x00aaff);
                      this.takeDamage(!isP, dmg);
                      shadow.destroy();
                      
                      this.time.delayedCall(400, () => {
                          if(this.scene.isActive()) {
                            this.tweens.add({
                                targets: attacker,
                                x: startX,
                                y: startY,
                                duration: 300,
                                onComplete: () => {
                                    attacker.anims.resume();
                                    this.setActionState(isP, false);
                                }
                            });
                          }
                      });
                  }
              });
          }
      });
  }

  // 8. PLASMA DASH (CYBER NINJA SPECIAL)
  private specialPlasmaDash(isP: boolean, isS: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const startX = attacker.x;
      const startY = attacker.y;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const baseDmg = isS ? 60 : 35;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));
      const dashColor = transLevel > 0 ? 0xff0055 : 0x00eaff;
      
      this.log("PLASMA DASH!");
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack', { rate: 2.0 });

      // Vanish
      attacker.setVisible(false);

      // Dash Line Visual
      const dashLine = this.add.rectangle(
          (startX + target.x) / 2, 
          startY + 50, 
          Math.abs(target.x - startX) + 100, 
          10, 
          dashColor
      ).setDepth(15).setAlpha(0.8);
      
      this.tweens.add({ targets: dashLine, scaleY: 0, alpha: 0, duration: 300 });

      // Teleport behind enemy
      const behindX = isP ? target.x + 80 : target.x - 80;
      attacker.setPosition(behindX, startY);
      attacker.setVisible(true);
      attacker.setFlipX(isP ? true : false); // Face back towards enemy

      // Impact Delay (The "Omae wa mou shindeiru" effect)
      this.time.delayedCall(400, () => {
          if (!this.scene.isActive()) return;
          
          // Slash Effect on Target
          const slash = this.add.graphics().setDepth(15);
          slash.lineStyle(4, dashColor);
          slash.lineBetween(target.x - 50, target.y + 50 - 50, target.x + 50, target.y + 50 + 50);
          this.tweens.add({ targets: slash, alpha: 0, duration: 200, onComplete: () => slash.destroy() });

          this.createImpactEffect(target.x, target.y + 50, dashColor);
          this.cameras.main.shake(200, 0.05);
          this.takeDamage(!isP, dmg);
          
          // Return to start
          this.time.delayedCall(300, () => {
              if(!this.scene.isActive()) return;
              attacker.setVisible(false); // Vanish
              
              // Teleport back start
              attacker.setPosition(startX, startY);
              attacker.setFlipX(isP ? false : true); // Reset flip
              attacker.setVisible(true);
              
              this.onSpecialComplete(isP);
          });
      });
  }

  // =========================================================================
  // 100% ULTIMATE ATTACKS
  // =========================================================================

  private specialGenkidama(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(120 * this.getDamageMultiplier(transLevel));

      this.log("GENKIDAMA!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // Raise hands
      attacker.y -= 20;

      // Create giant spirit bomb
      const bomb = this.add.circle(attacker.x, attacker.y - 150, 10, 0x00ffff).setDepth(15).setAlpha(0.8);
      
      // Grow
      this.tweens.add({
          targets: bomb,
          scale: 15,
          duration: 1000,
          onComplete: () => {
              if(!this.scene.isActive()) return;
              attacker.y += 20; // Lower hands
              // Throw
              this.tweens.add({
                  targets: bomb,
                  x: target.x,
                  y: target.y,
                  duration: 500,
                  ease: 'Power2',
                  onComplete: () => {
                      if(!this.scene.isActive()) return;
                      this.createImpactEffect(target.x, target.y, 0x00ffff);
                      this.cameras.main.shake(500, 0.05);
                      this.cameras.main.flash(300, 255, 255, 255);
                      this.takeDamage(!isP, dmg);
                      bomb.destroy();
                      this.onSpecialComplete(isP);
                  }
              });
          }
      });
  }

  private specialFinalFlash(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(110 * this.getDamageMultiplier(transLevel));
      const hand = this.getHandPosition(isP);

      this.log("FINAL FLASH!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // Charge
      const charge = this.add.circle(hand.x, hand.y, 5, 0xffff00).setDepth(15);
      this.tweens.add({ targets: charge, scale: 10, alpha: 0.5, duration: 800, yoyo: true, repeat: 0, onComplete: () => {
          if(!this.scene.isActive()) return;
          charge.destroy();
          
          // Massive Beam
          const beam = this.add.rectangle(hand.x, hand.y, 0, 80, 0xffff00).setOrigin(0, 0.5).setDepth(5).setAlpha(0.9);
          beam.scaleX = isP ? 1 : -1;
          const distance = Math.abs(target.x - hand.x) + 200;

          this.tweens.add({
              targets: beam,
              width: distance,
              duration: 200,
              onComplete: () => {
                  if(!this.scene.isActive()) return;
                  this.createImpactEffect(target.x, target.y, 0xffff00);
                  this.cameras.main.shake(600, 0.06);
                  this.takeDamage(!isP, dmg);
                  
                  this.tweens.add({
                      targets: beam,
                      alpha: 0,
                      scaleY: 0,
                      duration: 400,
                      onComplete: () => {
                          beam.destroy();
                          this.onSpecialComplete(isP);
                      }
                  });
              }
          });
      }});
  }

  private specialFatherSonKamehameha(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(115 * this.getDamageMultiplier(transLevel));
      const hand = this.getHandPosition(isP);

      this.log("FATHER-SON KAMEHAMEHA!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // Ghost Goku (Visual representation)
      const ghost = this.add.sprite(attacker.x + (isP ? -30 : 30), attacker.y - 40, 'goku_ssj').setAlpha(0).setScale(3).setDepth(0);
      ghost.setFlipX(!isP);
      this.tweens.add({ targets: ghost, alpha: 0.5, duration: 500 });

      // Massive Beam
      const beam = this.add.rectangle(hand.x, hand.y, 0, 100, 0x00ffff).setOrigin(0, 0.5).setDepth(5).setAlpha(0.9);
      beam.scaleX = isP ? 1 : -1;
      const distance = Math.abs(target.x - hand.x) + 200;

      this.time.delayedCall(500, () => {
          if(!this.scene.isActive()) return;
          this.tweens.add({
              targets: beam,
              width: distance,
              duration: 200,
              onComplete: () => {
                  if(!this.scene.isActive()) return;
                  this.createImpactEffect(target.x, target.y, 0x00ffff);
                  this.cameras.main.shake(800, 0.08);
                  this.takeDamage(!isP, dmg);
                  
                  this.tweens.add({
                      targets: [beam, ghost],
                      alpha: 0,
                      duration: 500,
                      onComplete: () => {
                          beam.destroy();
                          ghost.destroy();
                          this.onSpecialComplete(isP);
                      }
                  });
              }
          });
      });
  }

  private specialHellzoneGrenade(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(105 * this.getDamageMultiplier(transLevel));

      this.log("HELLZONE GRENADE!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      const orbs: Phaser.GameObjects.Arc[] = [];
      for(let i=0; i<8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const dist = 150;
          const orb = this.add.circle(target.x + Math.cos(angle)*dist, target.y - 50 + Math.sin(angle)*dist, 10, 0xffff00).setDepth(15).setAlpha(0);
          orbs.push(orb);
          this.tweens.add({ targets: orb, alpha: 1, duration: 400, delay: i * 50 });
      }

      this.time.delayedCall(800, () => {
          if(!this.scene.isActive()) return;
          orbs.forEach((orb, i) => {
              this.tweens.add({
                  targets: orb,
                  x: target.x,
                  y: target.y,
                  duration: 300,
                  ease: 'Power2',
                  onComplete: () => {
                      if(i === 0) {
                          this.createImpactEffect(target.x, target.y, 0xffff00);
                          this.cameras.main.shake(400, 0.05);
                          this.takeDamage(!isP, dmg);
                          this.onSpecialComplete(isP);
                      }
                      orb.destroy();
                  }
              });
          });
      });
  }

  private specialDeathBall(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(110 * this.getDamageMultiplier(transLevel));

      this.log("DEATH BALL!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // Create giant purple sphere
      const ball = this.add.circle(attacker.x, attacker.y - 100, 5, 0xff00ff).setDepth(15).setAlpha(0.9);
      
      // Grow
      this.tweens.add({
          targets: ball,
          scale: 12,
          duration: 800,
          onComplete: () => {
              if(!this.scene.isActive()) return;
              // Throw
              this.tweens.add({
                  targets: ball,
                  x: target.x,
                  y: target.y,
                  duration: 400,
                  ease: 'Power2',
                  onComplete: () => {
                      if(!this.scene.isActive()) return;
                      this.createImpactEffect(target.x, target.y, 0xff00ff);
                      this.cameras.main.shake(500, 0.06);
                      this.takeDamage(!isP, dmg);
                      ball.destroy();
                      this.onSpecialComplete(isP);
                  }
              });
          }
      });
  }

  private specialSolarKamehameha(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(120 * this.getDamageMultiplier(transLevel));
      const hand = this.getHandPosition(isP);

      this.log("SOLAR KAMEHAMEHA!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // Charge
      const charge = this.add.circle(hand.x, hand.y, 5, 0x00ff00).setDepth(15);
      this.tweens.add({ targets: charge, scale: 12, alpha: 0.5, duration: 800, yoyo: true, repeat: 0, onComplete: () => {
          if(!this.scene.isActive()) return;
          charge.destroy();
          
          // Massive Beam
          const beam = this.add.rectangle(hand.x, hand.y, 0, 90, 0x00ff00).setOrigin(0, 0.5).setDepth(5).setAlpha(0.9);
          beam.scaleX = isP ? 1 : -1;
          const distance = Math.abs(target.x - hand.x) + 200;

          this.tweens.add({
              targets: beam,
              width: distance,
              duration: 200,
              onComplete: () => {
                  if(!this.scene.isActive()) return;
                  this.createImpactEffect(target.x, target.y, 0x00ff00);
                  this.cameras.main.shake(700, 0.07);
                  this.takeDamage(!isP, dmg);
                  
                  this.tweens.add({
                      targets: beam,
                      alpha: 0,
                      scaleY: 0,
                      duration: 400,
                      onComplete: () => {
                          beam.destroy();
                          this.onSpecialComplete(isP);
                      }
                  });
              }
          });
      }});
  }

  private specialNinjaBarrage(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(100 * this.getDamageMultiplier(transLevel));
      const startX = attacker.x;

      this.log("NINJA BARRAGE!");
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack');

      // Dash to target
      this.tweens.add({
          targets: attacker,
          x: target.x + (isP ? -60 : 60),
          duration: 200,
          onComplete: () => {
              if(!this.scene.isActive()) return;
              
              // Multiple slashes
              for(let i=0; i<10; i++) {
                  this.time.delayedCall(i * 50, () => {
                      if(!this.scene.isActive()) return;
                      const slash = this.add.graphics().setDepth(15);
                      slash.lineStyle(4, 0x3498db);
                      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                      const len = 80;
                      const cx = target.x + Phaser.Math.Between(-20, 20);
                      const cy = target.y + Phaser.Math.Between(-20, 20);
                      slash.lineBetween(cx - Math.cos(angle)*len, cy - Math.sin(angle)*len, cx + Math.cos(angle)*len, cy + Math.sin(angle)*len);
                      this.tweens.add({ targets: slash, alpha: 0, duration: 100, onComplete: () => slash.destroy() });
                      if(i%3===0) this.createImpactEffect(cx, cy, 0x3498db);
                  });
              }

              this.time.delayedCall(600, () => {
                  if(!this.scene.isActive()) return;
                  this.takeDamage(!isP, dmg);
                  this.cameras.main.shake(300, 0.05);
                  // Dash back
                  this.tweens.add({
                      targets: attacker,
                      x: startX,
                      duration: 200,
                      onComplete: () => this.onSpecialComplete(isP)
                  });
              });
          }
      });
  }

  private specialBlackHole(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(115 * this.getDamageMultiplier(transLevel));

      this.log("BLACK HOLE!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // Create black hole on target
      const hole = this.add.circle(target.x, target.y, 5, 0x000000).setDepth(5);
      const ring = this.add.circle(target.x, target.y, 10, 0x9b59b6).setDepth(4).setStrokeStyle(4, 0x9b59b6);
      
      this.tweens.add({
          targets: [hole, ring],
          scale: 10,
          duration: 500,
          onComplete: () => {
              if(!this.scene.isActive()) return;
              
              // Suck effect
              this.tweens.add({
                  targets: target,
                  scale: 0.5,
                  alpha: 0.5,
                  duration: 400,
                  yoyo: true,
                  onComplete: () => {
                      if(!this.scene.isActive()) return;
                      this.createImpactEffect(target.x, target.y, 0x9b59b6);
                      this.cameras.main.shake(500, 0.06);
                      this.takeDamage(!isP, dmg);
                      hole.destroy();
                      ring.destroy();
                      this.onSpecialComplete(isP);
                  }
              });
          }
      });
  }

  private specialMatrixBlast(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(125 * this.getDamageMultiplier(transLevel));
      
      this.log("MATRIX BLAST!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // Open chest (visual effect)
      const matrix = this.add.circle(attacker.x, attacker.y - 20, 10, 0x00eaff).setDepth(15);
      this.tweens.add({ targets: matrix, scale: 5, alpha: 0.8, duration: 600, yoyo: true, repeat: 0, onComplete: () => {
          if(!this.scene.isActive()) return;
          matrix.destroy();
          
          // Massive Beam
          const beam = this.add.rectangle(attacker.x, attacker.y - 20, 0, 120, 0x00eaff).setOrigin(0, 0.5).setDepth(5).setAlpha(0.9);
          beam.scaleX = isP ? 1 : -1;
          const distance = Math.abs(target.x - attacker.x) + 200;

          this.tweens.add({
              targets: beam,
              width: distance,
              duration: 200,
              onComplete: () => {
                  if(!this.scene.isActive()) return;
                  this.createImpactEffect(target.x, target.y, 0x00eaff);
                  this.cameras.main.shake(800, 0.08);
                  this.takeDamage(!isP, dmg);
                  
                  this.tweens.add({
                      targets: beam,
                      alpha: 0,
                      scaleY: 0,
                      duration: 500,
                      onComplete: () => {
                          beam.destroy();
                          this.onSpecialComplete(isP);
                      }
                  });
              }
          });
      }});
  }

  private specialMegaPancake(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(130 * this.getDamageMultiplier(transLevel));
      const startX = attacker.x;
      const startY = attacker.y;

      this.log("MEGA PANCAKE!");
      
      attacker.anims.pause();
      
      // Shadow looming over target
      const shadow = this.add.ellipse(target.x, target.y + 30, 10, 5, 0x000000, 0.5);
      this.tweens.add({ targets: shadow, scaleX: 20, scaleY: 10, duration: 600 });

      // Giant Pancake visual
      const pancake = this.add.ellipse(target.x, target.y - 600, 150, 40, 0xd35400).setDepth(16);
      const butter = this.add.rectangle(target.x, target.y - 610, 30, 20, 0xf1c40f).setDepth(17);

      this.tweens.add({
          targets: [pancake, butter],
          y: '+=600',
          duration: 600,
          ease: 'Cubic.easeIn',
          onComplete: () => {
              if (!this.scene.isActive()) return;
              this.createImpactEffect(target.x, target.y, 0xd35400);
              this.cameras.main.shake(600, 0.08);
              this.takeDamage(!isP, dmg);
              
              this.tweens.add({
                  targets: [pancake, butter, shadow],
                  alpha: 0,
                  duration: 500,
                  onComplete: () => {
                      pancake.destroy();
                      butter.destroy();
                      shadow.destroy();
                      this.onSpecialComplete(isP);
                  }
              });
          }
      });
  }

  private specialCyberOverdrive(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(120 * this.getDamageMultiplier(transLevel));
      const startX = attacker.x;
      const startY = attacker.y;
      const dashColor = 0xff0055; // Always red for overdrive

      this.log("CYBER OVERDRIVE!");
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack', { rate: 1.5 });

      attacker.setVisible(false);

      // Multiple high speed dashes
      for(let i=0; i<8; i++) {
          this.time.delayedCall(i * 100, () => {
              if(!this.scene.isActive()) return;
              const angle = Phaser.Math.FloatBetween(0, Math.PI);
              const len = 300;
              const dashLine = this.add.rectangle(
                  target.x + Math.cos(angle)*100, 
                  target.y - 50 + Math.sin(angle)*100, 
                  len, 
                  15, 
                  dashColor
              ).setDepth(15).setAlpha(0.8);
              dashLine.rotation = angle;
              
              this.tweens.add({ targets: dashLine, scaleY: 0, alpha: 0, duration: 200, onComplete: () => dashLine.destroy() });
              this.createImpactEffect(target.x + Phaser.Math.Between(-30, 30), target.y + Phaser.Math.Between(-30, 30), dashColor);
          });
      }

      this.time.delayedCall(900, () => {
          if(!this.scene.isActive()) return;
          
          // Final massive slash
          const slash = this.add.graphics().setDepth(15);
          slash.lineStyle(10, dashColor);
          slash.lineBetween(target.x - 100, target.y - 100, target.x + 100, target.y + 100);
          this.tweens.add({ targets: slash, alpha: 0, duration: 300, onComplete: () => slash.destroy() });

          this.createImpactEffect(target.x, target.y, dashColor);
          this.cameras.main.shake(500, 0.08);
          this.takeDamage(!isP, dmg);
          
          attacker.setPosition(startX, startY);
          attacker.setVisible(true);
          this.onSpecialComplete(isP);
      });
  }

  private specialChipote(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(40 * this.getDamageMultiplier(transLevel));
      
      this.log("CHIPOTE CHILLÓN!");
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack');

      // Create a giant mallet sprite (using graphics)
      const mallet = this.add.graphics().setDepth(15);
      mallet.fillStyle(0xff0000, 1);
      mallet.fillRect(-20, -30, 40, 60); // Head
      mallet.fillStyle(0xffff00, 1);
      mallet.fillRect(-25, -20, 50, 40); // Yellow middle
      mallet.fillStyle(0xffff00, 1);
      mallet.fillRect(-5, 30, 10, 80); // Handle
      
      const startX = attacker.x + (isP ? 50 : -50);
      const startY = attacker.y - 100;
      mallet.setPosition(startX, startY);
      mallet.rotation = isP ? -Math.PI/4 : Math.PI/4;

      this.tweens.add({
          targets: mallet,
          x: target.x,
          y: target.y - 50,
          rotation: isP ? Math.PI/2 : -Math.PI/2,
          duration: 300,
          ease: 'Power2',
          onComplete: () => {
              this.cameras.main.shake(150, 0.02);
              this.createImpactEffect(target.x, target.y - 20, 0xff0000);
              if(this.cache.audio.exists('sfx_hit')) this.sound.play('sfx_hit');
              this.takeDamage(!isP, dmg);
              
              this.tweens.add({
                  targets: mallet,
                  alpha: 0,
                  y: target.y + 50,
                  duration: 200,
                  onComplete: () => {
                      mallet.destroy();
                      this.onSpecialComplete(isP);
                  }
              });
          }
      });
  }

  private specialAerolitos(isP: boolean) {
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(110 * this.getDamageMultiplier(transLevel));
      
      this.log("AEROLITOS!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      this.cameras.main.shake(800, 0.03);

      // Drop multiple meteorites
      for(let i=0; i<10; i++) {
          this.time.delayedCall(i * 100, () => {
              if(!this.scene.isActive()) return;
              
              const rock = this.add.graphics().setDepth(15);
              rock.fillStyle(0x7f8c8d, 1);
              rock.fillCircle(0, 0, Phaser.Math.Between(15, 30));
              
              const startX = target.x + Phaser.Math.Between(-150, 150);
              const startY = -50;
              const targetX = target.x + Phaser.Math.Between(-50, 50);
              const targetY = target.y + Phaser.Math.Between(-20, 50);
              
              rock.setPosition(startX, startY);
              
              this.tweens.add({
                  targets: rock,
                  x: targetX,
                  y: targetY,
                  duration: 400,
                  ease: 'Linear',
                  onComplete: () => {
                      this.createImpactEffect(targetX, targetY, 0xe74c3c);
                      if(this.cache.audio.exists('sfx_hit')) this.sound.play('sfx_hit', { volume: 0.5 });
                      rock.destroy();
                      
                      // Deal damage on the last hit
                      if (i === 9) {
                          this.takeDamage(!isP, dmg);
                          this.onSpecialComplete(isP);
                      }
                  }
              });
          });
      }
  }

  private specialRasengan(isP: boolean, isS: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const startX = attacker.x;
      const startY = attacker.y;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const baseDmg = isS ? 60 : 35;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));
      
      let color = 0x3498db; // Blue Rasengan
      let scaleTarget = 10;
      let attackName = "RASENGAN!";
      
      if (transLevel === 1) {
          scaleTarget = 15; // Oodama Rasengan (Bigger)
          attackName = "OODAMA RASENGAN!";
      } else if (transLevel === 2) {
          color = 0xffaa00; // Tailed Beast Rasengan (Orange)
          scaleTarget = 18;
          attackName = "TAILED BEAST RASENGAN!";
      }
      
      this.log(attackName);
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack', { rate: 1.5 });

      // Create Rasengan in hand
      const hand = this.getHandPosition(isP);
      const rasengan = this.add.circle(hand.x, hand.y, 2, color).setDepth(15).setAlpha(0.8);
      const rasenganCore = this.add.circle(hand.x, hand.y, 1, 0xffffff).setDepth(16);
      
      // 1. Charge effect (standing still)
      this.tweens.add({
          targets: [rasengan, rasenganCore],
          scale: scaleTarget,
          duration: 400,
          ease: 'Sine.easeOut',
          onUpdate: () => {
              const currentHand = this.getHandPosition(isP);
              rasengan.setPosition(currentHand.x, currentHand.y);
              rasenganCore.setPosition(currentHand.x, currentHand.y);
          },
          onComplete: () => {
              if(!this.scene.isActive()) return;
              
              // Swirling effect
              const swirlTween = this.tweens.add({ targets: rasengan, scale: 12, alpha: 0.5, duration: 100, yoyo: true, repeat: -1 });
              
              // 2. Dash towards enemy holding the Rasengan
              this.tweens.add({
                  targets: attacker,
                  x: target.x + (isP ? -100 : 100), // Stop slightly before the target
                  duration: 250,
                  ease: 'Power2',
                  onUpdate: () => {
                      const currentHand = this.getHandPosition(isP);
                      rasengan.setPosition(currentHand.x, currentHand.y);
                      rasenganCore.setPosition(currentHand.x, currentHand.y);
                  },
                  onComplete: () => {
                      if(!this.scene.isActive()) return;
                      
                      // 3. Throw the Rasengan into the opponent
                      this.tweens.add({
                          targets: [rasengan, rasenganCore],
                          x: target.x,
                          y: target.y,
                          duration: 150,
                          ease: 'Linear',
                          onComplete: () => {
                              if(!this.scene.isActive()) return;
                              swirlTween.stop();
                              
                              // Impact
                              this.createImpactEffect(target.x, target.y, color);
                              this.cameras.main.shake(300, 0.05);
                              if(this.cache.audio.exists('sfx_hit')) this.sound.play('sfx_hit');
                              this.takeDamage(!isP, dmg);
                              
                              rasengan.destroy();
                              rasenganCore.destroy();
                              
                              // Jump back
                              this.tweens.add({
                                  targets: attacker,
                                  x: startX,
                                  y: startY,
                                  duration: 300,
                                  ease: 'Power1',
                                  onComplete: () => {
                                      this.onSpecialComplete(isP);
                                  }
                              });
                          }
                      });
                  }
              });
          }
      });
  }

  private specialRasenshuriken(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(120 * this.getDamageMultiplier(transLevel));
      
      let color = 0x3498db; // Blue/White
      let attackName = "RASENSHURIKEN!";
      let scaleTarget = 1.5;
      
      if (transLevel === 1) {
          attackName = "SENPOU: RASENSHURIKEN!";
          scaleTarget = 2.0;
      } else if (transLevel === 2) {
          color = 0xffaa00; // Orange/Yellow
          attackName = "BIJUU RASENSHURIKEN!";
          scaleTarget = 2.5;
      }
      
      this.log(attackName);
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // Raise hand
      attacker.y -= 20;
      
      const hand = this.getHandPosition(isP);
      
      // Create Rasenshuriken
      const shuriken = this.add.graphics().setDepth(15);
      
      // Draw shuriken shape
      shuriken.fillStyle(color, 0.8);
      shuriken.fillCircle(0, 0, 15); // Core
      shuriken.fillStyle(0xffffff, 0.9);
      shuriken.fillCircle(0, 0, 8); // Inner core
      
      // Blades
      shuriken.lineStyle(4, color, 0.9);
      for(let i=0; i<4; i++) {
          const angle = (Math.PI / 2) * i;
          shuriken.lineBetween(
              Math.cos(angle) * 15, Math.sin(angle) * 15,
              Math.cos(angle) * 40, Math.sin(angle) * 40
          );
      }
      
      shuriken.setPosition(hand.x, hand.y - 30);
      
      // Spin and grow
      this.tweens.add({
          targets: shuriken,
          rotation: Math.PI * 4,
          scale: scaleTarget,
          duration: 800,
          onComplete: () => {
              if(!this.scene.isActive()) return;
              attacker.y += 20; // Lower hand
              
              // Throw
              this.tweens.add({
                  targets: shuriken,
                  x: target.x,
                  y: target.y,
                  rotation: Math.PI * 10, // Keep spinning
                  duration: 400,
                  ease: 'Linear',
                  onComplete: () => {
                      if(!this.scene.isActive()) return;
                      
                      // Massive expansion on impact
                      this.tweens.add({
                          targets: shuriken,
                          scale: 6,
                          alpha: 0,
                          duration: 300,
                          onComplete: () => {
                              this.createImpactEffect(target.x, target.y, color);
                              this.cameras.main.shake(600, 0.06);
                              this.cameras.main.flash(200, 255, 255, 255);
                              this.takeDamage(!isP, dmg);
                              shuriken.destroy();
                              this.onSpecialComplete(isP);
                          }
                      });
                  }
              });
          }
      });
  }

  createImpactEffect(x: number, y: number, color: number) {
      // Main Flash
      const boom = this.add.circle(x, y, 10, color).setDepth(20);
      this.tweens.add({ targets: boom, scale: 4, alpha: 0, duration: 300, onComplete: () => boom.destroy() });
      
      // Debris / Sparks
      for(let i=0; i<12; i++) { // More particles
          const p = this.add.rectangle(x, y, 5, 5, color).setDepth(20);
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const dist = Phaser.Math.Between(40, 100);
          
          this.tweens.add({
              targets: p,
              x: x + Math.cos(angle) * dist,
              y: y + Math.sin(angle) * dist,
              alpha: 0,
              scale: 0.2,
              duration: 500,
              onComplete: () => p.destroy()
          });
      }
  }

  takeDamage(isP: boolean, dmg: number) {
      if(this.isBattleOver || !this.scene.isActive()) return;
      
      const def = isP ? this.playerDefending : this.enemyDefending;
      if(def) {
          dmg = Math.floor(dmg * 0.3);
          // Block effect
          const target = isP ? this.player : this.enemy;
          this.createImpactEffect(target.x, target.y, 0x3498db); // Blue shield spark
          if(this.cache.audio.exists('sfx_block')) this.sound.play('sfx_block');
      } else {
          if(this.cache.audio.exists('sfx_hit')) this.sound.play('sfx_hit');
      }
      
      if(isP) this.playerHp = Math.max(0, this.playerHp - dmg);
      else this.enemyHp = Math.max(0, this.enemyHp - dmg);
      
      const target = isP ? this.player : this.enemy;
      if(target.active) {
          target.setTint(0xff0000);
          
          // Knockback / Shake effect
          const originalX = target.x;
          // Push back further if not defending
          const knockbackDist = def ? 10 : 30;
          const knockbackDir = isP ? -knockbackDist : knockbackDist;
          const rotDir = isP ? -0.1 : 0.1;
          
          this.tweens.add({
              targets: target,
              x: originalX + knockbackDir,
              rotation: rotDir,
              yoyo: true,
              duration: def ? 50 : 100,
              repeat: def ? 1 : 0,
              ease: 'Sine.easeOut',
              onComplete: () => {
                  if(target.active) {
                      target.clearTint();
                      target.x = originalX;
                      target.rotation = 0;
                  }
              }
          });
      }
      
      this.updateUI();
      if(this.playerHp <= 0 || this.enemyHp <= 0) this.endBattle(this.playerHp > 0);
  }

  modifyKi(isP: boolean, amt: number) {
      if(isP) this.playerKi = Phaser.Math.Clamp(this.playerKi + amt, 0, 100);
      else this.enemyKi = Phaser.Math.Clamp(this.enemyKi + amt, 0, 100);
      this.updateUI();
  }

  updateUI() {
      const p1p = this.playerHp / this.playerData.maxHp;
      const p2p = this.enemyHp / this.enemyData.maxHp;
      this.p1HpBar.width = 250 * p1p;
      this.p2HpBar.width = 250 * p2p;
      this.p1KiBar.width = 2.5 * this.playerKi;
      this.p2KiBar.width = 2.5 * this.enemyKi;
  }

  log(m: string) {
      if(!this.logText.active) return;
      this.logText.setText(m).setAlpha(1);
      this.tweens.add({ targets: this.logText, alpha: 0, delay: 1000, duration: 500 });
  }

  startAILoop() {
      const diff = this.gameState.difficulty; // 0: Easy, 1: Normal, 2: Hard
      let delay = 1500;
      if (diff === 0) delay = 2000;
      else if (diff === 1) delay = 1200;
      else if (diff === 2) delay = 700; // Much faster on Hard

      this.turnTimer = this.time.addEvent({
          delay: delay,
          loop: true,
          callback: () => this.enemyDecide()
      });
  }

  enemyDecide() {
      if(this.isBattleOver || this.p2ActionActive || !this.scene.isActive()) return;
      
      const r = Math.random();
      const playerHpPct = this.playerHp / this.playerData.maxHp;
      const enemyHpPct = this.enemyHp / this.enemyData.maxHp;
      
      // 1. Transform if available and have enough Ki
      let maxLevel = 1;
      if (this.enemyData.key === 'goku' || this.enemyData.key === 'vegeta' || this.enemyData.key === 'naruto') maxLevel = 2;

      if (this.enemyKi >= 100 && this.enemyTransformLevel < maxLevel && this.enemyData.transformAvailable) {
          this.performTransform(false);
          return;
      }
      
      // 2. If player is low on HP, prioritize finishing them off
      if (playerHpPct <= 0.3) {
          if (this.enemyKi >= 80 && r < 0.8) {
              this.performSpecial(false, true);
          } else if (this.enemyKi >= 40 && r < 0.7) {
              this.performSpecial(false, false);
          } else if (r < 0.6) {
              this.performAttack(false);
          } else {
              this.performCharge(false);
          }
          return;
      }
      
      // 3. If enemy is low on HP, play aggressively with specials or charge to get them
      if (enemyHpPct <= 0.4) {
          if (this.enemyKi >= 80) {
              this.performSpecial(false, true);
          } else if (this.enemyKi >= 40 && r < 0.6) {
              this.performSpecial(false, false);
          } else if (this.enemyKi < 40 && r < 0.8) {
              this.performCharge(false);
          } else {
              this.performAttack(false);
          }
          return;
      }
      
      // 4. If player has high Ki, try to interrupt them or defend
      if (this.playerKi >= 80) {
          if (r < 0.3) {
              // Defend for 1 second against potential super
              this.enemyDefending = true;
              this.p2Aura.setVisible(true).setAlpha(0.6).setScale(1.2); // Visual feedback
              this.time.delayedCall(1000, () => {
                  if (this.scene.isActive()) {
                      this.enemyDefending = false;
                      this.p2Aura.setVisible(false);
                  }
              });
              return;
          } else if (this.enemyKi >= 40 && r < 0.6) {
              this.performSpecial(false, false);
              return;
          } else if (r < 0.8) {
              this.performAttack(false);
              return;
          } else {
              this.performCharge(false);
              return;
          }
      }
      
      // 5. Standard tactical decisions based on Ki
      if (this.enemyKi >= 80) {
          // High Ki: Favor Super or Normal Special
          if (r < 0.5) this.performSpecial(false, true);
          else if (r < 0.8) this.performSpecial(false, false);
          else this.performAttack(false);
      } else if (this.enemyKi >= 40) {
          // Medium Ki: Mix of Special, Attack, and Charge
          if (r < 0.4) this.performSpecial(false, false);
          else if (r < 0.7) this.performAttack(false);
          else this.performCharge(false);
      } else {
          // Low Ki: Favor Charging
          if (r < 0.7) this.performCharge(false);
          else this.performAttack(false);
      }
  }

  endBattle(win: boolean) {
      if(this.isBattleOver) return; // Prevent double call
      this.isBattleOver = true;
      if(this.turnTimer) this.turnTimer.remove();
      if(this.regenTimer) this.regenTimer.remove();
      
      this.add.rectangle(480, 270, 960, 540, 0x000000, 0.7).setDepth(20);
      
      let message = "DEFEAT...";
      let color = '#f00';
      
      if (this.gameState.gameMode === 'local_pvp') {
          // PvP Outcome
          if (win) { // P1 Wins
              message = "PLAYER 1 WINS!";
              color = '#3498db'; // Blue
          } else { // P2 Wins
              message = "PLAYER 2 WINS!";
              color = '#e74c3c'; // Red
          }
          // Award coins in PvP regardless of who won (shared stash)
          this.gameState.coins += 100;
          window.UTLW.save();
      } else {
          // Single Player Outcome
          if (win) {
              message = "VICTORY!";
              color = '#0f0';
              this.gameState.coins += 100; 
              window.UTLW.save();
          }
      }

      this.add.text(480, 200, message, { fontSize: '64px', color: color }).setOrigin(0.5).setDepth(21);
      
      const btn = this.add.text(480, 350, "RETURN TO MENU", { fontSize: '32px' }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
