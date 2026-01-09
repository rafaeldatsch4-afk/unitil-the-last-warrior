
import Phaser from 'phaser';
import { CharacterData, GameState } from '../types';

export default class BattleScene extends Phaser.Scene {
  declare sound: Phaser.Sound.NoAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager | Phaser.Sound.WebAudioSoundManager;
  declare add: Phaser.GameObjects.GameObjectFactory;
  declare registry: Phaser.Data.DataManager;
  declare time: Phaser.Time.Clock;
  declare input: Phaser.Input.InputPlugin;
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
  
  private playerTransformed: boolean = false;
  private enemyTransformed: boolean = false;
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
    this.add.image(480, 270, 'arena').setDisplaySize(960, 540).setTint(0x888888).setDepth(-10);

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
    });
  }

  update(time: number, delta: number) {
    if(this.isBattleOver || !this.keys || !this.scene.isActive()) return;

    // --- PLAYER 1 CONTROLS ---
    if (!this.p1ActionActive) {
        // Defend / Charge
        if (this.keys.p1_defend.isDown) {
            this.playerDefending = true;
            this.performContinuousCharge(true, delta);
        } else {
            this.playerDefending = false;
            this.stopContinuousCharge(true);
            
            // Attack
            if(Phaser.Input.Keyboard.JustDown(this.keys.p1_attack)) this.performAttack(true);
            // Transform
            else if(Phaser.Input.Keyboard.JustDown(this.keys.p1_transform)) this.performTransform(true);
            
            // Special
            if (this.keys.p1_special.isDown) {
                this.p1SpecialHoldTime += delta;
                this.updateChargeIndicator(true, this.p1SpecialHoldTime);
            }
            if (Phaser.Input.Keyboard.JustUp(this.keys.p1_special)) {
                this.performSpecial(true, this.p1SpecialHoldTime >= this.SUPER_THRESHOLD_MS);
                this.p1SpecialHoldTime = 0;
                this.clearChargeIndicator(true);
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
      this.p1Aura = this.add.circle(this.p1StartPos.x, this.p1StartPos.y, 50, 0x3498db, 0.5).setVisible(false).setDepth(0);

      // Player 2
      this.enemy = this.add.sprite(this.p2StartPos.x, this.p2StartPos.y, this.enemyData.key)
          .setScale(3)
          .setFlipX(true)
          .setDepth(1);
      this.createAnimsFor(this.enemyData.key);
      this.enemy.play(`${this.enemyData.key}_idle`, true);
      this.add.ellipse(this.p2StartPos.x, this.p2StartPos.y + 180, 100, 30, 0x000000, 0.5).setDepth(0);
      this.p2Aura = this.add.circle(this.p2StartPos.x, this.p2StartPos.y, 50, 0xe74c3c, 0.5).setVisible(false).setDepth(0);
  }

  createAnimsFor(key: string) {
      const createAnim = (animKey: string, texture: string) => {
          if(!this.textures.exists(texture)) return;
          if(!this.anims.exists(animKey)) {
             this.anims.create({
                  key: animKey,
                  frames: this.anims.generateFrameNumbers(texture, { 
                      start: 0, 
                      end: 3,
                      frameWidth: 64, // Must match generated texture frame size
                      frameHeight: 128
                  }),
                  frameRate: 6,
                  repeat: -1
              });
          }
      };
      createAnim(`${key}_idle`, key);
      createAnim(`${key}_ssj_idle`, `${key}_ssj`);
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
          p2_transform: Phaser.Input.Keyboard.KeyCodes.LEFT
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
  }

  performAttack(isPlayer: boolean) {
      if(this.isBattleOver) return;
      const attacker = isPlayer ? this.player : this.enemy;
      const target = isPlayer ? this.enemy : this.player;
      const startX = isPlayer ? this.p1StartPos.x : this.p2StartPos.x;
      const isTrans = isPlayer ? this.playerTransformed : this.enemyTransformed;

      this.setActionState(isPlayer, true);

      this.tweens.add({
          targets: attacker,
          x: target.x + (isPlayer ? -60 : 60),
          yoyo: true,
          duration: 150,
          onComplete: () => {
             if (!this.scene.isActive()) return;
             attacker.x = startX;
             if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack');
             this.takeDamage(!isPlayer, isTrans ? 15 : 8); 
             this.modifyKi(isPlayer, 5);
             
             // Cooldown after attack
             this.time.delayedCall(100, () => {
                 if(this.scene.isActive()) this.setActionState(isPlayer, false);
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
      const aura = this.add.circle(sprite.x, sprite.y + 20, 10, isPlayer ? 0x3498db : 0xe74c3c, 0.6);
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
      const isAlready = isPlayer ? this.playerTransformed : this.enemyTransformed;
      const sprite = isPlayer ? this.player : this.enemy;

      if(!data.transformAvailable || isAlready || ki < 100) return;

      this.setActionState(isPlayer, true);
      this.modifyKi(isPlayer, -100);
      if(isPlayer) this.playerTransformed = true; else this.enemyTransformed = true;
      
      // FX: Massive pillar of light
      const pillar = this.add.rectangle(sprite.x, sprite.y, 60, 1000, 0xffd700).setAlpha(0).setDepth(2);
      
      this.tweens.add({
          targets: sprite,
          y: sprite.y - 50,
          duration: 400,
          yoyo: true,
          onYoyo: () => {
              if (!this.scene.isActive()) return;
              if(this.textures.exists(`${data.key}_ssj`)) {
                  sprite.setTexture(`${data.key}_ssj`);
                  if(this.anims.exists(`${data.key}_ssj_idle`)) sprite.play(`${data.key}_ssj_idle`);
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
              const ring = this.add.circle(sprite.x, sprite.y, 20, 0xffd700, 0)
                  .setStrokeStyle(4, 0xffff00)
                  .setDepth(2);
              this.tweens.add({
                  targets: ring,
                  scale: 15,
                  alpha: { start: 1, end: 0 },
                  duration: 500,
                  onComplete: () => { if(this.scene.isActive()) ring.destroy(); }
              });
          },
          onComplete: () => {
              if(this.scene.isActive()) this.setActionState(isPlayer, false);
          }
      });
      this.log(`${data.name} TRANSFORMED!`);
  }

  performSpecial(isPlayer: boolean, isSuper: boolean) {
      if(this.isBattleOver) return;
      const ki = isPlayer ? this.playerKi : this.enemyKi;
      const data = isPlayer ? this.playerData : this.enemyData;
      const cost = isSuper ? 80 : 40;

      if(ki < cost) { 
          if(isPlayer) this.log(`Need ${cost} Ki!`); 
          return; 
      }

      this.setActionState(isPlayer, true);
      this.modifyKi(isPlayer, -cost);

      switch(data.key) {
          case 'goku':
          case 'cell': this.specialBeam(isPlayer, isSuper, data.specialColor, true); break;
          case 'vegeta': this.specialBeam(isPlayer, isSuper, 0x9b59b6, false, true); break;
          case 'piccolo': this.specialMakanko(isPlayer, isSuper); break;
          case 'frieza': this.specialDeathBeam(isPlayer, isSuper); break;
          case 'gohan': this.specialBeam(isPlayer, isSuper, 0xffff00, false); break;
          case 'leonardo': this.specialSlash(isPlayer, isSuper); break;
          case 'frieren': this.specialZoltraak(isPlayer, isSuper); break;
          case 'optimus': this.specialMissiles(isPlayer, isSuper); break;
          case 'minipekka': this.specialPancake(isPlayer, isSuper); break;
          default: this.specialBeam(isPlayer, isSuper, data.specialColor, false); break;
      }
  }

  // --- REFACTORED SPECIALS ---

  private onSpecialComplete(isPlayer: boolean) {
      // Small delay before allowing input again
      this.time.delayedCall(200, () => {
          if(this.scene.isActive()) this.setActionState(isPlayer, false);
      });
  }

  private specialBeam(isP: boolean, isS: boolean, col: number, hasInner: boolean, vibrate: boolean = false) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      
      // Safety check
      if(!attacker.active || !target.active) {
          this.setActionState(isP, false);
          return;
      }

      const startX = isP ? attacker.x + 30 : attacker.x - 30;
      const endX = target.x;
      const y = attacker.y - 10;
      const size = isS ? 2 : 1;

      this.log(isS ? "SUPER BEAM!!" : "ENERGY BEAM!");
      const main = this.add.rectangle(startX, y, 0, 30 * size, col).setOrigin(isP ? 0 : 1, 0.5).setDepth(5);
      const head = this.add.circle(startX, y, 20 * size, 0xffffff).setDepth(5);
      let inner: Phaser.GameObjects.Rectangle | null = null;
      if(hasInner) inner = this.add.rectangle(startX, y, 0, 15 * size, 0xffffff).setOrigin(isP ? 0 : 1, 0.5).setDepth(6);
      
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      this.tweens.add({
          targets: main,
          width: Math.abs(endX - startX),
          duration: 300,
          onUpdate: () => { 
              if(!this.scene.isActive()) return;
              if(inner && inner.active) inner.width = main.width; 
              if(vibrate) main.y = y + (Math.random() * 4 - 2); 
          },
          onComplete: () => {
              if (!this.scene.isActive()) return;
              this.takeDamage(!isP, isS ? 60 : 35);
              this.cameras.main.shake(200, isS ? 0.05 : 0.02);
              this.tweens.add({ 
                  targets: [main, head, inner].filter(Boolean), 
                  alpha: 0, 
                  duration: 200, 
                  onComplete: () => { 
                      if(this.scene.isActive()) {
                          main.destroy(); head.destroy(); inner?.destroy(); 
                          this.onSpecialComplete(isP);
                      }
                  }
              });
          }
      });
      this.tweens.add({ targets: head, x: endX, duration: 300 });
  }

  private specialMakanko(isP: boolean, isS: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const startX = isP ? attacker.x + 30 : attacker.x - 30;
      const endX = target.x;
      const y = attacker.y - 10;

      this.log("MAKANKOSAPPO!");
      const core = this.add.rectangle(startX, y, 0, 6, 0xffff00).setOrigin(isP ? 0 : 1, 0.5).setDepth(5);
      const spiral = this.add.graphics().setDepth(6);
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');
      
      this.tweens.add({
          targets: core,
          width: Math.abs(endX - startX),
          duration: 500,
          onUpdate: (tw, targetObj) => {
              if(!this.scene.isActive()) return;
              spiral.clear();
              spiral.lineStyle(2, 0xffcc00);
              const currentW = core.width;
              for(let i=0; i<currentW; i+=10) {
                  const angle = (i * 0.2) + (this.time.now * 0.01);
                  const sy = y + Math.sin(angle) * 15;
                  const sx = isP ? startX + i : startX - i;
                  if(i === 0) spiral.moveTo(sx, sy); else spiral.lineTo(sx, sy);
              }
              spiral.strokePath();
          },
          onComplete: () => {
              if (!this.scene.isActive()) return;
              this.takeDamage(!isP, isS ? 70 : 45);
              this.cameras.main.shake(300, 0.04);
              this.tweens.add({ 
                  targets: [core, spiral], 
                  alpha: 0, 
                  duration: 200, 
                  onComplete: () => { 
                      if(this.scene.isActive()) {
                        core.destroy(); spiral.destroy(); 
                        this.onSpecialComplete(isP);
                      }
                  }
              });
          }
      });
  }

  private specialDeathBeam(isP: boolean, isS: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const beam = this.add.line(0, 0, attacker.x, attacker.y - 10, target.x, target.y - 10, 0xff00ff)
          .setOrigin(0).setLineWidth(isS ? 4 : 2).setDepth(5);
      this.log("DEATH BEAM!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');
      this.time.delayedCall(50, () => {
          if (!this.scene.isActive()) return;
          this.takeDamage(!isP, isS ? 50 : 25);
          this.cameras.main.flash(50, 255, 0, 255, true);
          this.tweens.add({ 
              targets: beam, alpha: 0, duration: 100, 
              onComplete: () => {
                  if(this.scene.isActive()) {
                      beam.destroy();
                      this.onSpecialComplete(isP);
                  }
              }
           });
      });
  }

  private specialSlash(isP: boolean, isS: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const startX = isP ? this.p1StartPos.x : this.p2StartPos.x;
      const targetX = isP ? 850 : 100;

      this.log("KATANA SLASH!");
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack');
      this.tweens.add({
          targets: attacker,
          x: targetX,
          duration: 200,
          onComplete: () => {
              if (!this.scene.isActive()) return;
              const slash = this.add.graphics().setDepth(5);
              slash.lineStyle(4, 0xffffff);
              const tY = this.p2StartPos.y;
              const tX = isP ? this.p2StartPos.x : this.p1StartPos.x;
              slash.moveTo(tX - 50, tY - 50);
              slash.lineTo(tX + 50, tY + 50);
              slash.strokePath();
              this.takeDamage(!isP, isS ? 55 : 30);
              this.time.delayedCall(200, () => {
                  if(this.scene.isActive()) {
                    slash.destroy();
                    attacker.x = startX;
                    this.onSpecialComplete(isP);
                  }
              });
          }
      });
  }

  private specialZoltraak(isP: boolean, isS: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const circle = this.add.circle(attacker.x + (isP?50:-50), attacker.y - 10, 30).setStrokeStyle(2, 0xffffff).setDepth(5);
      this.log("ZOLTRAAK!");
      this.tweens.add({ targets: circle, angle: 360, duration: 500, onComplete: () => {
          if(!this.scene.isActive()) return;
          this.specialBeam(isP, isS, 0xdfe6e9, true);
          circle.destroy();
      }});
  }

  private specialMissiles(isP: boolean, isS: boolean) {
      this.log("MISSILE STRIKE!");
      const count = isS ? 6 : 3;
      for(let i=0; i<count; i++) {
          this.time.delayedCall(i * 100, () => {
              if(this.scene.isActive()) this.throwProjectile(isP, 'missile', 0xffffff, false);
          });
      }
      this.time.delayedCall(count * 100, () => {
          if(this.scene.isActive()) {
            this.takeDamage(!isP, isS ? 30 : 15);
            this.onSpecialComplete(isP);
          }
      });
  }

  private specialPancake(isP: boolean, isS: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const startX = isP ? this.p1StartPos.x : this.p2StartPos.x;
      const startY = isP ? this.p1StartPos.y : this.p2StartPos.y;
      const target = isP ? this.enemy : this.player;

      this.log("PANCAKES!");
      this.tweens.add({
          targets: attacker,
          y: startY - 200,
          x: target.x,
          duration: 400,
          ease: 'Cubic.easeOut',
          onComplete: () => {
              if (!this.scene.isActive()) return;
              this.tweens.add({
                  targets: attacker,
                  y: startY,
                  duration: 200,
                  ease: 'Cubic.easeIn',
                  onComplete: () => {
                      if (!this.scene.isActive()) return;
                      this.cameras.main.shake(200, 0.05);
                      this.takeDamage(!isP, isS ? 80 : 50);
                      this.time.delayedCall(200, () => {
                          if(this.scene.isActive()) {
                            attacker.x = startX;
                            this.onSpecialComplete(isP);
                          }
                      });
                  }
              });
          }
      });
  }

  // --- HELPER UTILS ---

  throwProjectile(isP: boolean, key: string, tint: number, isS: boolean) {
      if(!this.scene.isActive()) return;
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      
      const proj = this.add.sprite(attacker.x, attacker.y - 10, key).setTint(tint).setScale(isS ? 4 : 2).setDepth(5);
      if(!isP) proj.setFlipX(true);
      
      this.tweens.add({
          targets: proj,
          x: target.x,
          duration: 400,
          onComplete: () => { 
              if(this.scene.isActive()) {
                proj.destroy(); 
                if(!isS) this.takeDamage(!isP, 20); 
              }
          }
      });
  }

  takeDamage(isP: boolean, dmg: number) {
      if(this.isBattleOver || !this.scene.isActive()) return;
      
      const def = isP ? this.playerDefending : this.enemyDefending;
      if(def) dmg = Math.floor(dmg * 0.3);
      
      if(isP) this.playerHp = Math.max(0, this.playerHp - dmg);
      else this.enemyHp = Math.max(0, this.enemyHp - dmg);
      
      const target = isP ? this.player : this.enemy;
      if(target.active) {
          target.setTint(0xff0000);
          this.time.delayedCall(100, () => { 
              if(target.active) target.clearTint(); 
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
      this.turnTimer = this.time.addEvent({
          delay: 1500,
          loop: true,
          callback: () => this.enemyDecide()
      });
  }

  enemyDecide() {
      if(this.isBattleOver || this.p2ActionActive || !this.scene.isActive()) return;
      const r = Math.random();
      
      // AI Logic
      if(this.enemyKi >= 100 && !this.enemyTransformed) this.performTransform(false);
      else if(this.enemyKi >= 60 && r < 0.3) this.performSpecial(false, true);
      else if(this.enemyKi >= 40 && r < 0.6) this.performSpecial(false, false);
      else if(r < 0.3) this.performAttack(false);
      else this.performCharge(false);
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
