
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
  mobileP1KiBlast = false;
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
                this.performAttack(true, 'melee');
                this.mobileP1Attack = false; // Reset flag
            }
            // Ki Blast
            else if(Phaser.Input.Keyboard.JustDown(this.keys.p1_kiblast) || this.mobileP1KiBlast) {
                this.performAttack(true, 'ki');
                this.mobileP1KiBlast = false; // Reset flag
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

            if(Phaser.Input.Keyboard.JustDown(this.keys.p2_attack)) this.performAttack(false, 'melee');
            else if(Phaser.Input.Keyboard.JustDown(this.keys.p2_kiblast)) this.performAttack(false, 'ki');
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
          .setOrigin(0.5, 0.5)
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
          .setOrigin(0.5, 0.5)
          .setScale(3)
          .setFlipX(true)
          .setDepth(1);
      this.createAnimsFor(this.enemyData.key);
      this.enemy.play(`${this.enemyData.key}_idle`, true);
      this.add.ellipse(this.p2StartPos.x, this.p2StartPos.y + 180, 100, 30, 0x000000, 0.5).setDepth(0);
      this.p2Aura = this.add.circle(this.p2StartPos.x, this.p2StartPos.y + 80, 50, 0xe74c3c, 0.5).setVisible(false).setDepth(0);
  }

  createAnimsFor(key: string) {
      const createAnim = (animKey: string, texture: string, start: number, end: number, frameRate: number, repeat: number = -1) => {
          if(!this.textures.exists(texture)) return;
          if(!this.anims.exists(animKey)) {
             this.anims.create({
                  key: animKey,
                  frames: this.anims.generateFrameNumbers(texture, { 
                      start: start, 
                      end: end
                  }),
                  frameRate: frameRate,
                  repeat: repeat
              });
          }
      };
      createAnim(`${key}_idle`, key, 0, 3, 6);
      createAnim(`${key}_attack`, key, 4, 5, 12, 0);
      createAnim(`${key}_ssj_idle`, `${key}_ssj`, 0, 3, 6);
      createAnim(`${key}_ssj_attack`, `${key}_ssj`, 4, 5, 12, 0);
      if (key === 'goku' || key === 'vegeta' || key === 'naruto') {
          createAnim(`${key}_ui_idle`, `${key}_ui`, 0, 3, 6);
          createAnim(`${key}_ui_attack`, `${key}_ui`, 4, 5, 12, 0);
      }
  }

  createInputs() {
      if(!this.input.keyboard) return;
      
      // Clean up old keys if any (defensive)
      this.input.keyboard.removeAllKeys();

      this.keys = this.input.keyboard.addKeys({
          p1_attack: Phaser.Input.Keyboard.KeyCodes.W,
          p1_kiblast: Phaser.Input.Keyboard.KeyCodes.E,
          p1_defend: Phaser.Input.Keyboard.KeyCodes.S,
          p1_special: Phaser.Input.Keyboard.KeyCodes.D,
          p1_transform: Phaser.Input.Keyboard.KeyCodes.A,
          p2_attack: Phaser.Input.Keyboard.KeyCodes.UP,
          p2_kiblast: Phaser.Input.Keyboard.KeyCodes.ENTER,
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
      createBtn(780, 450, 'KI', 0x00ffff, () => { this.mobileP1KiBlast = true; });
      createBtn(860, 350, 'SPC', 0xf1c40f, 
          () => { this.mobileP1Special = true; }, 
          () => { this.mobileP1Special = false; this.mobileP1SpecialJustUp = true; }
      );

      // Pause Button (Top Center)
      const pauseBtn = this.add.circle(480, 40, 30, 0x333333, 0.6).setInteractive().setDepth(100);
      this.add.text(480, 40, '||', { fontSize: '24px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(101);
      
      pauseBtn.on('pointerdown', () => {
          pauseBtn.setAlpha(0.9);
          if(this.cache.audio.exists('sfx_select')) this.sound.play('sfx_select');
          this.scene.pause();
          this.scene.launch('PauseScene');
      });
      
      pauseBtn.on('pointerup', () => pauseBtn.setAlpha(0.6));
      pauseBtn.on('pointerout', () => pauseBtn.setAlpha(0.6));
  }

  getAnimKey(baseKey: string, transLevel: number, animType: string): string {
      let texKey = baseKey;
      if (transLevel === 1) texKey = `${baseKey}_ssj`;
      else if (transLevel === 2) texKey = `${baseKey}_ui`;
      
      // Fallback to base animation if transformed animation doesn't exist
      const animKey = `${texKey}_${animType}`;
      if (this.anims.exists(animKey)) {
          return animKey;
      }
      return `${baseKey}_${animType}`;
  }

  performAttack(isPlayer: boolean, attackType: 'melee' | 'ki') {
      if(this.isBattleOver) return;
      const attacker = isPlayer ? this.player : this.enemy;
      const target = isPlayer ? this.enemy : this.player;
      const startX = isPlayer ? this.p1StartPos.x : this.p2StartPos.x;
      const startY = isPlayer ? this.p1StartPos.y : this.p2StartPos.y;
      const transLevel = isPlayer ? this.playerTransformLevel : this.enemyTransformLevel;
      const attackerData = isPlayer ? this.playerData : this.enemyData;

      this.setActionState(isPlayer, true);

      // 1. Windup (Hop Back & Rotate)
      const windupDist = isPlayer ? -60 : 60;
      const rotDir = isPlayer ? -0.3 : 0.3;

      this.tweens.add({
          targets: attacker,
          x: startX + windupDist,
          y: startY - 20,
          rotation: rotDir,
          scaleX: 2.8,
          scaleY: 3.2,
          duration: 150, // Slightly longer windup for impact
          ease: 'Back.easeOut',
          onComplete: () => {
              if(!this.scene.isActive()) return;
              
              if (attackType === 'melee') {
                  // MELEE: Quick Lunge with Follow-Through
                  const trailTimer = this.time.addEvent({
                      delay: 15,
                      callback: () => {
                          if (!this.scene.isActive() || !attacker.active) return;
                          const ghost = this.add.sprite(attacker.x, attacker.y, attacker.texture.key, attacker.frame.name)
                              .setOrigin(0.5, 0.5)
                              .setScale(attacker.scaleX, attacker.scaleY)
                              .setRotation(attacker.rotation)
                              .setFlipX(attacker.flipX)
                              .setTint(0x00ffff)
                              .setAlpha(0.6)
                              .setDepth(0);
                          this.tweens.add({
                              targets: ghost,
                              alpha: 0,
                              scaleX: 1.2,
                              scaleY: 1.2,
                              duration: 150,
                              onComplete: () => ghost.destroy()
                          });
                      },
                      repeat: 10
                  });

                  // Lunge Forward
                  attacker.play(this.getAnimKey(attackerData.key, transLevel, 'attack'));
                  this.tweens.add({
                      targets: attacker,
                      x: target.x + (isPlayer ? -30 : 30), // Deeper lunge
                      y: startY,
                      rotation: -rotDir * 2.5, // More rotation for follow-through
                      scaleX: 3.4,
                      scaleY: 2.6,
                      duration: 100, // Faster lunge
                      ease: 'Expo.easeIn',
                      onComplete: () => {
                         trailTimer.remove();
                         if (!this.scene.isActive()) return;
                         
                         // Impact
                         if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack', { volume: 1.2 });
                         
                         const baseDamage = 10;
                         const damage = Math.floor(baseDamage * this.getDamageMultiplier(transLevel));
                         
                         this.takeDamage(!isPlayer, damage); 
                         this.modifyKi(isPlayer, 5);
                         
                         // Visual Impact
                         this.createImpactEffect(target.x, target.y - 20, 0xffffff);
                         
                         // Target hit flash
                         this.tweens.add({
                             targets: target,
                             alpha: 0.5,
                             yoyo: true,
                             duration: 50,
                             repeat: 1
                         });

                         // Follow-through pause and return
                         this.time.delayedCall(100, () => {
                             if (!this.scene.isActive()) return;
                             // Return
                             this.tweens.add({
                                 targets: attacker,
                                 x: startX,
                                 y: startY,
                                 rotation: 0,
                                 scaleX: 3,
                                 scaleY: 3,
                                 duration: 300,
                                 ease: 'Back.easeOut',
                                 onComplete: () => {
                                     if(this.scene.isActive()) {
                                         attacker.play(this.getAnimKey(attackerData.key, transLevel, 'idle'));
                                         this.setActionState(isPlayer, false);
                                     }
                                 }
                             });
                         });
                      }
                  });
              } else {
                  // BEAM: Gather energy then shoot
                  const blastColor = attackerData.specialColor || 0x00ffff;
                  
                  // Gathering energy spark
                  const gatherSpark = this.add.circle(attacker.x + (isPlayer ? 40 : -40), attacker.y - 10, 2, blastColor).setDepth(6);
                  this.tweens.add({
                      targets: gatherSpark,
                      scale: 8,
                      alpha: 0.8,
                      duration: 150,
                      yoyo: true,
                      onComplete: () => gatherSpark.destroy()
                  });

                  attacker.play(this.getAnimKey(attackerData.key, transLevel, 'attack'));
                  this.tweens.add({
                      targets: attacker,
                      x: startX + (isPlayer ? 30 : -30), // Forward lunge to throw
                      y: startY,
                      rotation: -rotDir * 0.8,
                      scaleX: 3.2,
                      scaleY: 2.8,
                      duration: 150,
                      ease: 'Power2',
                      onComplete: () => {
                         if (!this.scene.isActive()) return;
                         
                         // Shoot Blast
                         if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam', { volume: 1.2 });
                         
                         // Attacker flash
                         this.tweens.add({
                             targets: attacker,
                             alpha: 0.7,
                             yoyo: true,
                             duration: 50
                         });
                         
                         const originX = attacker.x + (isPlayer ? 50 : -50);
                         const originY = attacker.y - 10;
                         
                         // Muzzle flash at origin
                         const muzzle = this.add.circle(originX, originY, 25, blastColor).setDepth(4);
                         muzzle.setBlendMode(Phaser.BlendModes.ADD);
                         this.tweens.add({ targets: muzzle, scale: 0, alpha: 0, duration: 200, onComplete: () => muzzle.destroy() });

                         const blast = this.add.circle(originX, originY, 18, blastColor).setDepth(5);
                         const core = this.add.circle(blast.x, blast.y, 10, 0xffffff).setDepth(6);
                         blast.setBlendMode(Phaser.BlendModes.ADD);
                         
                         // Continuous Beam trail
                         const trailLine = this.add.graphics().setDepth(3);
                         trailLine.setBlendMode(Phaser.BlendModes.ADD);
                         
                         const trailUpdateEvent = this.time.addEvent({
                             delay: 10,
                             callback: () => {
                                 if (!this.scene.isActive() || !blast.active) return;
                                 trailLine.clear();
                                 trailLine.lineStyle(20, blastColor, 0.6);
                                 trailLine.lineBetween(originX, originY, blast.x, blast.y);
                                 trailLine.lineStyle(10, 0xffffff, 0.8);
                                 trailLine.lineBetween(originX, originY, blast.x, blast.y);
                             },
                             loop: true
                         });
                         
                         this.tweens.add({
                             targets: [blast, core],
                             x: target.x,
                             duration: 120, // Faster beam
                             ease: 'Linear',
                             onComplete: () => {
                                 trailUpdateEvent.remove();
                                 this.tweens.add({
                                     targets: trailLine,
                                     alpha: 0,
                                     duration: 150,
                                     onComplete: () => trailLine.destroy()
                                 });
                                 blast.destroy();
                                 core.destroy();
                                 
                                 if (!this.scene.isActive()) return;
                                 
                                 // Impact
                                 if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack', { volume: 1.5 });
                                 
                                 const baseDamage = 10;
                                 const damage = Math.floor(baseDamage * this.getDamageMultiplier(transLevel));
                                 
                                 this.takeDamage(!isPlayer, damage); 
                                 this.modifyKi(isPlayer, 5);
                                 
                                 // Visual Impact
                                 this.createImpactEffect(target.x, target.y - 20, blastColor, 'beam');
                                 
                                 // Target hit flash
                                 this.tweens.add({
                                     targets: target,
                                     alpha: 0.5,
                                     yoyo: true,
                                     duration: 50,
                                     repeat: 2
                                 });
                             }
                         });

                         // Return
                         this.tweens.add({
                             targets: attacker,
                             x: startX,
                             y: startY,
                             rotation: 0,
                             scaleX: 3,
                             scaleY: 3,
                             duration: 300,
                             ease: 'Back.easeOut',
                             delay: 150,
                             onComplete: () => {
                                 if(this.scene.isActive()) {
                                     attacker.play(this.getAnimKey(attackerData.key, transLevel, 'idle'));
                                     this.setActionState(isPlayer, false);
                                 }
                             }
                         });
                      }
                  });
              }
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
      } else if (data.key === 'thukuna') {
          auraColor = 0x8b0000; // Dark Red
          ringColor = 0x000000; // Black
          transformText = "TRUE FORM!";
      } else if (data.key === 'gojo') {
          auraColor = 0x00ffff; // Bright Blue
          ringColor = 0xffffff; // White
          transformText = "LIMITLESS!";
      }

      // 1. Initial Charge Up (Screen darkens significantly)
      const darkenColor = data.key === 'thukuna' ? 0x4a0000 : 0x000000;
      const darken = this.add.rectangle(480, 270, 960, 540, darkenColor, 0).setDepth(1);
      this.tweens.add({ targets: darken, fillAlpha: 0.7, duration: 800 });
      
      let darkAuraElements: Phaser.GameObjects.GameObject[] = [];
      if (data.key === 'thukuna') {
          // Pulsating dark red/black aura behind him
          for (let i = 0; i < 3; i++) {
              const auraRing = this.add.circle(sprite.x, sprite.y, 40 + (i * 20), 0x8b0000, 0.3).setDepth(1);
              auraRing.setBlendMode(Phaser.BlendModes.ADD);
              this.tweens.add({
                  targets: auraRing,
                  scale: 3 + i,
                  alpha: { start: 0.5, end: 0 },
                  duration: 800 + (i * 200),
                  repeat: -1,
                  yoyo: false
              });
              darkAuraElements.push(auraRing);
          }
          
          // Rising dark energy particles
          for (let i = 0; i < 15; i++) {
              const darkParticle = this.add.circle(
                  sprite.x + Phaser.Math.Between(-60, 60), 
                  sprite.y + Phaser.Math.Between(0, 100), 
                  Phaser.Math.Between(4, 12), 
                  0x000000, 
                  0.7
              ).setDepth(2);
              this.tweens.add({
                  targets: darkParticle,
                  y: sprite.y - Phaser.Math.Between(150, 300),
                  x: darkParticle.x + Phaser.Math.Between(-30, 30),
                  alpha: 0,
                  scale: 0.5,
                  duration: Phaser.Math.Between(600, 1200),
                  repeat: -1
              });
              darkAuraElements.push(darkParticle);
          }
          this.cameras.main.shake(800, 0.01);
      }
      
      // Gathering energy particles
      for (let i = 0; i < 20; i++) {
          const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180);
          const distance = Phaser.Math.Between(100, 300);
          const startX = sprite.x + Math.cos(angle) * distance;
          const startY = sprite.y + Math.sin(angle) * distance;
          
          const particle = this.add.circle(startX, startY, Phaser.Math.Between(2, 4), auraColor).setDepth(2).setAlpha(0);
          
          this.tweens.add({
              targets: particle,
              x: sprite.x,
              y: sprite.y,
              alpha: { start: 0, end: 1 },
              duration: Phaser.Math.Between(400, 800),
              ease: 'Cubic.easeIn',
              onComplete: () => particle.destroy()
          });
      }

      // Pre-transform shake and float
      this.tweens.add({
          targets: sprite,
          x: sprite.x + (isPlayer ? 5 : -5),
          yoyo: true,
          repeat: 15,
          duration: 40,
          onComplete: () => {
              if (!this.scene.isActive()) return;
              
              // 2. The Explosion / Flash
              // FX: Massive pillar of light
              const pillar = this.add.rectangle(sprite.x, sprite.y, 150, 1200, auraColor).setAlpha(0).setDepth(2);
              pillar.setBlendMode(Phaser.BlendModes.ADD);
              
              // Float up slightly during the flash
              this.tweens.add({
                  targets: sprite,
                  y: sprite.y - 80,
                  duration: 500,
                  yoyo: true,
                  ease: 'Sine.easeInOut',
                  onYoyo: () => {
                      if (!this.scene.isActive()) return;
                      
                      let texKey = `${data.key}_ssj`;
                      if (isUI || isUE || isKuramaMode) texKey = `${data.key}_ui`;

                      if(this.textures.exists(texKey)) {
                          sprite.setTexture(texKey);
                          const animKeyIdle = this.getAnimKey(data.key, nextLevel, 'idle');
                          if(this.anims.exists(animKeyIdle)) sprite.play(animKeyIdle);
                      }
                      
                      // Big Flash & Shake
                      if (data.key === 'thukuna') {
                          // Invert colors momentarily for an "impact frame" feel
                          this.cameras.main.flash(800, 255, 0, 0, true);
                          
                          // Thukuna specific slash effects - make them sharper and cleaner
                          for(let i=0; i<8; i++) {
                              this.time.delayedCall(i * 60, () => {
                                  if(!this.scene.isActive()) return;
                                  const cx = sprite.x + Phaser.Math.Between(-100, 100);
                                  const cy = sprite.y + Phaser.Math.Between(-150, 150);
                                  const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180);
                                  const length = Phaser.Math.Between(100, 250);
                                  
                                  const slash = this.add.graphics().setDepth(15);
                                  // White core with red outline for a sharp cursed energy slash
                                  slash.lineStyle(6, 0xff0000, 0.8);
                                  slash.beginPath();
                                  slash.moveTo(cx - Math.cos(angle)*length/2, cy - Math.sin(angle)*length/2);
                                  slash.lineTo(cx + Math.cos(angle)*length/2, cy + Math.sin(angle)*length/2);
                                  slash.strokePath();
                                  
                                  slash.lineStyle(2, 0xffffff, 1);
                                  slash.beginPath();
                                  slash.moveTo(cx - Math.cos(angle)*length/2, cy - Math.sin(angle)*length/2);
                                  slash.lineTo(cx + Math.cos(angle)*length/2, cy + Math.sin(angle)*length/2);
                                  slash.strokePath();
                                  
                                  this.tweens.add({
                                      targets: slash,
                                      alpha: 0,
                                      scale: 1.2,
                                      duration: 150,
                                      ease: 'Expo.easeOut',
                                      onComplete: () => slash.destroy()
                                  });
                                  
                                  if(this.cache.audio.exists('sfx_hit')) this.sound.play('sfx_hit', { volume: 0.3, rate: 1.5 });
                              });
                          }
                          
                          // Massive dark red aura burst (Domain Expansion style)
                          const redBurst = this.add.circle(sprite.x, sprite.y, 5, 0x000000).setDepth(1);
                          redBurst.setStrokeStyle(10, 0x8b0000);
                          this.tweens.add({
                              targets: redBurst,
                              scale: 150,
                              alpha: 0,
                              strokeWidth: 0,
                              duration: 1000,
                              ease: 'Cubic.easeOut',
                              onComplete: () => redBurst.destroy()
                          });
                      } else {
                          this.cameras.main.flash(800, 255, 255, 255, true);
                      }
                      
                      this.cameras.main.shake(1000, 0.05);
                      if(this.cache.audio.exists('sfx_transform')) this.sound.play('sfx_transform', { volume: 1.5 });

                      // Pillar Animation
                      pillar.setAlpha(1).setScale(0, 1);
                      this.tweens.add({
                          targets: pillar,
                          scaleX: 4,
                          alpha: 0,
                          duration: 1000,
                          ease: 'Power2',
                          onComplete: () => { if(this.scene.isActive()) pillar.destroy(); }
                      });

                      // Shockwave Rings (Multiple, expanding outwards)
                      for (let i = 0; i < 4; i++) {
                          this.time.delayedCall(i * 100, () => {
                              if (!this.scene.isActive()) return;
                              const ring = this.add.circle(sprite.x, sprite.y, 10, auraColor, 0)
                                  .setStrokeStyle(8 - i * 1.5, ringColor)
                                  .setDepth(2);
                              this.tweens.add({
                                  targets: ring,
                                  scale: 30 + (i * 10),
                                  alpha: { start: 1, end: 0 },
                                  duration: 800,
                                  ease: 'Cubic.easeOut',
                                  onComplete: () => { if(this.scene.isActive()) ring.destroy(); }
                              });
                          });
                      }

                      // Update continuous charge aura color
                      const chargeAura = isPlayer ? this.p1Aura : this.p2Aura;
                      if (chargeAura && chargeAura.active) {
                          (chargeAura as Phaser.GameObjects.Shape).setFillStyle(auraColor, 0.6);
                      }

                      // Intense particles bursting outwards
                      for (let i = 0; i < 40; i++) {
                          const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180);
                          const speed = Phaser.Math.Between(100, 400);
                          const spark = this.add.circle(sprite.x, sprite.y, Phaser.Math.Between(3, 8), ringColor).setDepth(3);
                          spark.setBlendMode(Phaser.BlendModes.ADD);
                          
                          this.tweens.add({
                              targets: spark,
                              x: spark.x + Math.cos(angle) * speed,
                              y: spark.y + Math.sin(angle) * speed - Phaser.Math.Between(50, 150), // Upward bias
                              alpha: 0,
                              scale: 0,
                              duration: Phaser.Math.Between(800, 1500),
                              ease: 'Power2',
                              onComplete: () => spark.destroy()
                          });
                      }
                  },
                  onComplete: () => {
                      if(!this.scene.isActive()) return;
                      // Remove darken overlay
                      this.tweens.add({
                          targets: darken,
                          fillAlpha: 0,
                          duration: 500,
                          onComplete: () => {
                              darken.destroy();
                              this.setActionState(isPlayer, false);
                          }
                      });
                      
                      if (darkAuraElements.length > 0) {
                          darkAuraElements.forEach(el => {
                              this.tweens.add({
                                  targets: el,
                                  alpha: 0,
                                  duration: 500,
                                  onComplete: () => el.destroy()
                              });
                          });
                      }
                  }
              });
              
              // Dramatic text display
              let textFill = '#ffffff';
              let textStroke = '#000000';
              if (data.key === 'thukuna') {
                  textFill = '#ff0000';
                  textStroke = '#330000';
              }
              
              const textObj = this.add.text(480, 200, transformText, {
                  fontFamily: 'Impact, sans-serif',
                  fontSize: '64px',
                  color: textFill,
                  stroke: textStroke,
                  strokeThickness: 8,
                  fontStyle: 'italic'
              }).setOrigin(0.5).setDepth(10).setAlpha(0).setScale(0.5);
              
              this.tweens.add({
                  targets: textObj,
                  alpha: 1,
                  scale: 1.2,
                  duration: 300,
                  yoyo: true,
                  hold: 1000,
                  ease: 'Back.easeOut',
                  onComplete: () => textObj.destroy()
              });
              
              this.log(transformText);
          }
      });
  }

  // --- ANIMATION SEQUENCE (FIXED: NO MOVEMENT) ---
  animateCastSequence(attacker: Phaser.GameObjects.Sprite, isPlayer: boolean, tintColor: number, animKeyAttack: string, animKeyIdle: string, onFireCallback: () => void) {
      attacker.play(animKeyAttack);

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
                          // Let onSpecialComplete handle returning to idle
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
          const transLevel = isPlayer ? this.playerTransformLevel : this.enemyTransformLevel;
          const animKeyAttack = this.getAnimKey(data.key, transLevel, 'attack');
          const animKeyIdle = this.getAnimKey(data.key, transLevel, 'idle');
          this.animateCastSequence(sprite, isPlayer, data.specialColor, animKeyAttack, animKeyIdle, () => {
              switch(data.key) {
                  case 'goku':
                      if (isSuper) this.specialGenkidama(isPlayer);
                      else this.specialKamehameha(isPlayer);
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
                  case 'batman':
                      if (isSuper) this.specialTheDarkKnight(isPlayer);
                      else this.specialBatarang(isPlayer);
                      break;
                  case 'thukuna':
                      if (isSuper) this.specialMalevolentShrine(isPlayer);
                      else this.specialCleave(isPlayer);
                      break;
                  case 'gojo':
                      if (isSuper) this.specialHollowPurple(isPlayer);
                      else this.specialRedAndBlue(isPlayer);
                      break;
                  default: 
                      this.specialBeam(isPlayer, isSuper, data.specialColor, false, false, 'generic'); 
                      break;
              }
          });
      }
  }

  private onSpecialComplete(isPlayer: boolean) {
      const data = isPlayer ? this.playerData : this.enemyData;
      const transLevel = isPlayer ? this.playerTransformLevel : this.enemyTransformLevel;
      const animKeyIdle = this.getAnimKey(data.key, transLevel, 'idle');
      const attacker = isPlayer ? this.player : this.enemy;

      if(this.scene.isActive()) attacker.play(animKeyIdle);

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

  private specialKamehameha(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      if(!attacker.active || !target.active) { this.setActionState(isP, false); return; }

      const baseDmg = 35;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));

      const size = 1.8; 
      
      const hand = this.getHandPosition(isP);
      const endX = target.x;
      const distance = Math.abs(endX - hand.x);

      // Muzzle Flash (Charge)
      const muzzle = this.add.circle(hand.x, hand.y, 5, 0x00ffff).setDepth(7).setAlpha(0.8);
      // Flash Tween
      this.tweens.add({ targets: muzzle, scale: 6, alpha: 0.2, duration: 150, yoyo: true, repeat: 1 });
      // Shake during charge
      this.cameras.main.shake(100, 0.01);

      this.log("KAMEHAMEHA!");
      if(this.cache.audio.exists('sfx_beam')) this.sound.play('sfx_beam');

      // The Beam Structure
      const originX = 0; 
      
      // Main Color Beam (outer cyan)
      const beamMain = this.add.rectangle(hand.x, hand.y, 0, 24 * size, 0x00ffff).setOrigin(originX, 0.5).setDepth(5).setAlpha(0.9);
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
          tint: 0x00ffff
      }).setDepth(4);

      // Animation
      this.tweens.add({
          targets: [beamMain, beamCore],
          width: distance, 
          duration: 250,
          ease: 'Linear',
          onUpdate: () => {
              if(!this.scene.isActive()) return;
              
              const shakeAmt = 1;
              const jitterY = Phaser.Math.Between(-shakeAmt, shakeAmt);

              beamMain.y = hand.y + jitterY;
              beamCore.y = hand.y + jitterY;
              
              const currentWidth = beamMain.width;
              const headX = isP ? hand.x + currentWidth : hand.x - currentWidth;
              beamHead.setPosition(headX, hand.y + jitterY);
              
              particles.emitParticleAt(headX, hand.y + jitterY);
          },
          onComplete: () => {
              this.takeDamage(!isP, dmg);
              this.cameras.main.shake(300, 0.02);
              
              // Impact explosion
              const explosion = this.add.circle(endX, hand.y, 40 * size, 0x00ffff).setDepth(8);
              this.tweens.add({ targets: explosion, scale: 1.5, alpha: 0, duration: 200, onComplete: () => explosion.destroy() });

              // Fade out beam
              this.tweens.add({ 
                  targets: [beamMain, beamCore, beamHead, muzzle].filter(Boolean), 
                  alpha: 0, 
                  duration: 200, 
                  onComplete: () => { 
                      beamMain.destroy(); 
                      beamCore.destroy();
                      beamHead.destroy();
                      muzzle.destroy();
                      particles.stop();
                      this.time.delayedCall(200, () => particles.destroy());
                      
                      // Cooldown - slightly longer
                      this.time.delayedCall(400, () => {
                          if(this.scene.isActive()) this.setActionState(isP, false);
                      });
                  }
              });
          }
      });
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
              
              this.createImpactEffect(endX, hand.y, col, 'beam');
              this.takeDamage(!isP, dmg);
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
              this.createImpactEffect(endX, hand.y, 0xffff00, 'beam');
              this.takeDamage(!isP, dmg);
              
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
              
              this.createImpactEffect(target.x, hand.y, 0x3498db, 'beam');
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
              
              this.createImpactEffect(target.x, hand.y, 0x000000, 'beam');
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
      const attackerData = isP ? this.playerData : this.enemyData;
      const baseDmg = isS ? 80 : 50;
      const dmg = Math.floor(baseDmg * this.getDamageMultiplier(transLevel));

      this.log("PANCAKES!");
      
      const animKeyAttack = this.getAnimKey(attackerData.key, transLevel, 'attack');
      const animKeyIdle = this.getAnimKey(attackerData.key, transLevel, 'idle');
      attacker.play(animKeyAttack);
      
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

          this.createImpactEffect(target.x, target.y + 50, dashColor, 'beam');
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
                      this.createImpactEffect(target.x, target.y, 0x00ffff, 'beam');
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
                  this.createImpactEffect(target.x, target.y, 0xffff00, 'beam');
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
      const ghost = this.add.sprite(attacker.x + (isP ? -30 : 30), attacker.y - 40, 'goku_ssj')
          .setOrigin(0.5, 0.5)
          .setAlpha(0)
          .setScale(3)
          .setDepth(0);
      ghost.setFlipX(!isP);
      if (this.anims.exists('goku_ssj_attack')) {
          ghost.play('goku_ssj_attack');
      }
      this.tweens.add({ targets: ghost, alpha: 0.6, duration: 500 });

      // Massive Beam using the new texture
      const beam = this.add.sprite(hand.x, hand.y, 'massive_beam')
          .setOrigin(0, 0.5)
          .setDepth(5)
          .setAlpha(0.9);
      beam.scaleX = isP ? 0.1 : -0.1;
      beam.scaleY = 0.5;
      
      const distance = Math.abs(target.x - hand.x) + 200;
      const targetScaleX = (isP ? distance : -distance) / 128; // 128 is the width of massive_beam

      // Muzzle Flash
      const muzzle = this.add.circle(hand.x, hand.y, 40, 0x00ffff).setDepth(6);
      muzzle.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: muzzle, scale: 0, alpha: 0, duration: 300, onComplete: () => muzzle.destroy() });

      this.time.delayedCall(500, () => {
          if(!this.scene.isActive()) return;
          
          this.cameras.main.shake(1000, 0.04);
          
          this.tweens.add({
              targets: beam,
              scaleX: targetScaleX,
              scaleY: 2.5,
              duration: 200,
              ease: 'Power2',
              onComplete: () => {
                  if(!this.scene.isActive()) return;
                  this.createImpactEffect(target.x, target.y, 0x00ffff, 'beam');
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
                          this.createImpactEffect(target.x, target.y, 0xffff00, 'beam');
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
                      this.createImpactEffect(target.x, target.y, 0xff00ff, 'beam');
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
                  this.createImpactEffect(target.x, target.y, 0x00ff00, 'beam');
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
                      this.createImpactEffect(target.x, target.y, 0x9b59b6, 'beam');
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
                  this.createImpactEffect(target.x, target.y, 0x00eaff, 'beam');
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
      const attackerData = isP ? this.playerData : this.enemyData;
      const dmg = Math.floor(130 * this.getDamageMultiplier(transLevel));
      const startX = attacker.x;
      const startY = attacker.y;

      this.log("MEGA PANCAKE!");
      
      const animKeyAttack = this.getAnimKey(attackerData.key, transLevel, 'attack');
      const animKeyIdle = this.getAnimKey(attackerData.key, transLevel, 'idle');
      attacker.play(animKeyAttack);
      
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
              this.createImpactEffect(target.x, target.y, 0xd35400, 'beam');
              this.takeDamage(!isP, dmg);
              
              this.tweens.add({
                  targets: [pancake, butter, shadow],
                  alpha: 0,
                  duration: 500,
                  onComplete: () => {
                      pancake.destroy();
                      butter.destroy();
                      shadow.destroy();
                      attacker.play(animKeyIdle);
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

          this.createImpactEffect(target.x, target.y, dashColor, 'beam');
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
              this.createImpactEffect(target.x, target.y - 20, 0xff0000, 'beam');
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
                              this.createImpactEffect(target.x, target.y, color, 'beam');
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
                              this.createImpactEffect(target.x, target.y, color, 'beam');
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

  private specialBatarang(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(35 * this.getDamageMultiplier(transLevel));
      
      this.log("BATARANG!");
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack');

      const hand = this.getHandPosition(isP);
      
      // Throw 3 batarangs
      for(let i=0; i<3; i++) {
          this.time.delayedCall(i * 150, () => {
              if(!this.scene.isActive()) return;
              
              const batarang = this.add.sprite(hand.x, hand.y, 'batarang')
                  .setOrigin(0.5, 0.5)
                  .setDepth(15);
              
              // Spin animation
              this.tweens.add({
                  targets: batarang,
                  angle: 360 * 4,
                  duration: 400,
                  ease: 'Linear'
              });

              // Move to target
              this.tweens.add({
                  targets: batarang,
                  x: target.x,
                  y: target.y + Phaser.Math.Between(-20, 20),
                  duration: 400,
                  ease: 'Power1',
                  onComplete: () => {
                      if(!this.scene.isActive()) return;
                      this.createImpactEffect(batarang.x, batarang.y, 0x111111);
                      if(this.cache.audio.exists('sfx_hit')) this.sound.play('sfx_hit');
                      batarang.destroy();
                      
                      if (i === 2) {
                          this.takeDamage(!isP, dmg);
                          this.onSpecialComplete(isP);
                      }
                  }
              });
          });
      }
  }

  private specialTheDarkKnight(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(100 * this.getDamageMultiplier(transLevel));
      const startX = attacker.x;

      this.log("THE DARK KNIGHT!");
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack');

      // Screen goes dark
      const darkOverlay = this.add.rectangle(this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height, 0x000000, 0).setDepth(10);
      
      this.tweens.add({
          targets: darkOverlay,
          fillAlpha: 0.8,
          duration: 300,
          onComplete: () => {
              if(!this.scene.isActive()) return;
              
              // Teleport behind target
              attacker.x = target.x + (isP ? 60 : -60);
              
              // Multiple strikes in the dark
              for(let i=0; i<8; i++) {
                  this.time.delayedCall(i * 100, () => {
                      if(!this.scene.isActive()) return;
                      const cx = target.x + Phaser.Math.Between(-30, 30);
                      const cy = target.y + Phaser.Math.Between(-40, 40);
                      this.createImpactEffect(cx, cy, 0xffffff);
                      if(this.cache.audio.exists('sfx_hit')) this.sound.play('sfx_hit');
                  });
              }

              this.time.delayedCall(900, () => {
                  if(!this.scene.isActive()) return;
                  
                  // Final explosive strike
                  this.createImpactEffect(target.x, target.y, 0xf1c40f, 'beam');
                  this.takeDamage(!isP, dmg);
                  
                  // Fade out darkness and return
                  this.tweens.add({
                      targets: darkOverlay,
                      fillAlpha: 0,
                      duration: 300,
                      onComplete: () => {
                          darkOverlay.destroy();
                          attacker.x = startX;
                          this.onSpecialComplete(isP);
                      }
                  });
              });
          }
      });
  }

  private specialCleave(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(45 * this.getDamageMultiplier(transLevel));
      const hand = this.getHandPosition(isP);

      this.log("CLEAVE!");
      if(this.cache.audio.exists('sfx_attack')) this.sound.play('sfx_attack');

      // Create invisible slash effect
      const slash = this.add.graphics().setDepth(15);
      slash.lineStyle(4, 0xff0000, 0.8);
      slash.beginPath();
      slash.moveTo(target.x - 30, target.y - 30);
      slash.lineTo(target.x + 30, target.y + 30);
      slash.strokePath();
      
      const slash2 = this.add.graphics().setDepth(15);
      slash2.lineStyle(4, 0xff0000, 0.8);
      slash2.beginPath();
      slash2.moveTo(target.x + 30, target.y - 30);
      slash2.lineTo(target.x - 30, target.y + 30);
      slash2.strokePath();

      this.tweens.add({
          targets: [slash, slash2],
          alpha: 0,
          scale: 1.5,
          duration: 300,
          onComplete: () => {
              slash.destroy();
              slash2.destroy();
              this.createImpactEffect(target.x, target.y, 0xff0000);
              this.takeDamage(!isP, dmg);
              this.onSpecialComplete(isP);
          }
      });
  }

  private specialMalevolentShrine(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(140 * this.getDamageMultiplier(transLevel));

      this.log("CASTELO MANIVOLENTE!");
      
      // Screen goes dark red
      const darkOverlay = this.add.rectangle(this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height, 0x5a0000, 0).setDepth(8);
      
      this.tweens.add({
          targets: darkOverlay,
          fillAlpha: 0.8,
          duration: 500,
          onComplete: () => {
              if(!this.scene.isActive()) return;
              
              // Shrine visual (Demonic Temple)
              const shrine = this.add.graphics().setDepth(9);
              const sx = attacker.x;
              const sy = attacker.y - 40;
              
              // Base/Platform
              shrine.fillStyle(0x1a1a1a, 1);
              shrine.fillRect(sx - 100, sy, 200, 40);
              shrine.fillRect(sx - 80, sy - 20, 160, 20);
              
              // Pillars
              shrine.fillStyle(0x2a0000, 1);
              shrine.fillRect(sx - 60, sy - 120, 20, 100);
              shrine.fillRect(sx + 40, sy - 120, 20, 100);
              
              // Roof tiers (Pagoda style)
              shrine.fillStyle(0x0f0f0f, 1);
              shrine.beginPath();
              shrine.moveTo(sx - 90, sy - 120);
              shrine.lineTo(sx + 90, sy - 120);
              shrine.lineTo(sx + 70, sy - 150);
              shrine.lineTo(sx - 70, sy - 150);
              shrine.closePath();
              shrine.fillPath();
              
              shrine.beginPath();
              shrine.moveTo(sx - 60, sy - 150);
              shrine.lineTo(sx + 60, sy - 150);
              shrine.lineTo(sx + 40, sy - 190);
              shrine.lineTo(sx - 40, sy - 190);
              shrine.closePath();
              shrine.fillPath();
              
              // Center Core / Mouth
              shrine.fillStyle(0x000000, 1);
              shrine.fillRect(sx - 30, sy - 100, 60, 80);
              shrine.fillStyle(0x8b0000, 1);
              shrine.fillCircle(sx, sy - 60, 15); // Glowing eye/core
              
              // Skulls/Bones scattered
              shrine.fillStyle(0xdddddd, 1);
              for(let k=0; k<8; k++) {
                  shrine.fillCircle(sx + Phaser.Math.Between(-80, 80), sy + Phaser.Math.Between(0, 30), Phaser.Math.Between(3, 6));
              }
              
              // Shrine entrance animation
              shrine.setAlpha(0);
              shrine.y += 50;
              this.tweens.add({
                  targets: shrine,
                  alpha: 1,
                  y: '-=50',
                  duration: 400,
                  ease: 'Back.easeOut'
              });
              
              this.cameras.main.shake(1500, 0.02);

              // Relentless slashes (Cleave/Dismantle storm)
              for(let i=0; i<20; i++) {
                  this.time.delayedCall(i * 80, () => {
                      if(!this.scene.isActive()) return;
                      const cx = target.x + Phaser.Math.Between(-60, 60);
                      const cy = target.y + Phaser.Math.Between(-80, 80);
                      const angle = Phaser.Math.Between(0, 360) * (Math.PI / 180);
                      const length = Phaser.Math.Between(60, 150);
                      
                      const slash = this.add.graphics().setDepth(15);
                      
                      // Black core
                      slash.lineStyle(6, 0x000000, 1);
                      slash.beginPath();
                      slash.moveTo(cx - Math.cos(angle)*length/2, cy - Math.sin(angle)*length/2);
                      slash.lineTo(cx + Math.cos(angle)*length/2, cy + Math.sin(angle)*length/2);
                      slash.strokePath();
                      
                      // Red outline
                      slash.lineStyle(2, 0xff0000, 1);
                      slash.beginPath();
                      slash.moveTo(cx - Math.cos(angle)*length/2, cy - Math.sin(angle)*length/2);
                      slash.lineTo(cx + Math.cos(angle)*length/2, cy + Math.sin(angle)*length/2);
                      slash.strokePath();
                      
                      this.tweens.add({
                          targets: slash,
                          alpha: 0,
                          scaleX: 1.5,
                          duration: 150,
                          onComplete: () => slash.destroy()
                      });

                      this.createImpactEffect(cx, cy, 0x8b0000);
                      if(this.cache.audio.exists('sfx_hit')) this.sound.play('sfx_hit', { volume: 0.5 });
                  });
              }

              this.time.delayedCall(1800, () => {
                  if(!this.scene.isActive()) return;
                  
                  // Final massive slash
                  this.createImpactEffect(target.x, target.y, 0xff0000, 'beam');
                  this.takeDamage(!isP, dmg);
                  
                  // Fade out domain
                  this.tweens.add({
                      targets: [darkOverlay, shrine],
                      alpha: 0,
                      duration: 500,
                      onComplete: () => {
                          darkOverlay.destroy();
                          shrine.destroy();
                          this.onSpecialComplete(isP);
                      }
                  });
              });
          }
      });
  }

  private specialRedAndBlue(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(45 * this.getDamageMultiplier(transLevel));

      this.log("CURSED TECHNIQUE: RED & BLUE!");
      
      const hand = this.getHandPosition(isP);
      
      // Create Blue (Attract)
      const blue = this.add.circle(hand.x, hand.y - 20, 5, 0x0000ff, 1).setDepth(10);
      // Create Red (Repel)
      const red = this.add.circle(hand.x, hand.y + 20, 5, 0xff0000, 1).setDepth(10);
      
      this.tweens.add({
          targets: [blue, red],
          scale: 4,
          duration: 400,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
              // Shoot them
              this.tweens.add({
                  targets: blue,
                  x: target.x,
                  y: target.y - 20,
                  duration: 300,
                  ease: 'Power2'
              });
              this.tweens.add({
                  targets: red,
                  x: target.x,
                  y: target.y + 20,
                  duration: 300,
                  ease: 'Power2',
                  onComplete: () => {
                      blue.destroy();
                      red.destroy();
                      this.createImpactEffect(target.x, target.y, 0x8a2be2, 'beam');
                      this.takeDamage(!isP, dmg);
                      this.onSpecialComplete(isP);
                  }
              });
          }
      });
  }

  private specialHollowPurple(isP: boolean) {
      const attacker = isP ? this.player : this.enemy;
      const target = isP ? this.enemy : this.player;
      const transLevel = isP ? this.playerTransformLevel : this.enemyTransformLevel;
      const dmg = Math.floor(150 * this.getDamageMultiplier(transLevel));

      this.log("HOLLOW PURPLE!");
      
      const hand = this.getHandPosition(isP);
      
      // Screen darken
      const darkOverlay = this.add.rectangle(this.cameras.main.width/2, this.cameras.main.height/2, this.cameras.main.width, this.cameras.main.height, 0x000000, 0).setDepth(8);
      this.tweens.add({ targets: darkOverlay, fillAlpha: 0.7, duration: 500 });
      
      // Combine Red and Blue
      const blue = this.add.circle(hand.x - 30, hand.y, 15, 0x0000ff, 1).setDepth(10);
      const red = this.add.circle(hand.x + 30, hand.y, 15, 0xff0000, 1).setDepth(10);
      
      this.tweens.add({
          targets: [blue, red],
          x: hand.x,
          duration: 800,
          ease: 'Power2',
          onComplete: () => {
              blue.destroy();
              red.destroy();
              
              // Purple Core
              const purple = this.add.circle(hand.x, hand.y, 25, 0x8a2be2, 1).setDepth(10);
              const purpleAura = this.add.circle(hand.x, hand.y, 40, 0x8a2be2, 0.5).setDepth(9);
              
              this.cameras.main.flash(200, 138, 43, 226);
              this.cameras.main.shake(400, 0.01);
              
              this.time.delayedCall(500, () => {
                  // Fire Hollow Purple
                  this.tweens.add({
                      targets: [purple, purpleAura],
                      x: isP ? target.x + 200 : target.x - 200, // Go through target
                      scale: 5,
                      duration: 600,
                      ease: 'Power2',
                      onUpdate: () => {
                          // Destroy everything in its path (visual effect)
                          if (Math.abs(purple.x - target.x) < 50) {
                              this.createImpactEffect(target.x, target.y, 0x8a2be2);
                              this.cameras.main.shake(100, 0.05);
                          }
                      },
                      onComplete: () => {
                          purple.destroy();
                          purpleAura.destroy();
                          
                          this.createImpactEffect(target.x, target.y, 0x8a2be2, 'beam');
                          this.takeDamage(!isP, dmg);
                          
                          this.tweens.add({
                              targets: darkOverlay,
                              alpha: 0,
                              duration: 500,
                              onComplete: () => {
                                  darkOverlay.destroy();
                                  this.onSpecialComplete(isP);
                              }
                          });
                      }
                  });
              });
          }
      });
  }

  createImpactEffect(x: number, y: number, color: number, type: 'melee' | 'beam' | 'block' = 'melee') {
      const isBeam = type === 'beam';
      const isBlock = type === 'block';

      // Main Flash - Make it bigger and punchier
      const boom = this.add.circle(x, y, isBeam ? 40 : (isBlock ? 15 : 20), color).setDepth(20);
      this.tweens.add({ 
          targets: boom, 
          scale: isBeam ? 8 : (isBlock ? 3 : 6), 
          alpha: 0, 
          duration: isBeam ? 350 : 250, 
          ease: 'Cubic.easeOut',
          onComplete: () => boom.destroy() 
      });
      
      // Add an inner white core for more impact
      const core = this.add.circle(x, y, isBeam ? 20 : 10, 0xffffff).setDepth(21);
      this.tweens.add({ 
          targets: core, 
          scale: isBeam ? 6 : 4, 
          alpha: 0, 
          duration: isBeam ? 200 : 150, 
          ease: 'Cubic.easeOut',
          onComplete: () => core.destroy() 
      });
      
      // Debris / Sparks - Faster and more dynamic
      const particleCount = isBeam ? 24 : (isBlock ? 8 : 16);
      for(let i=0; i<particleCount; i++) { 
          const p = this.add.rectangle(x, y, isBeam ? 8 : 6, isBeam ? 8 : 6, isBlock ? 0x3498db : color).setDepth(20);
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const dist = isBeam ? Phaser.Math.Between(100, 250) : Phaser.Math.Between(60, 150);
          
          this.tweens.add({
              targets: p,
              x: x + Math.cos(angle) * dist,
              y: y + Math.sin(angle) * dist,
              alpha: 0,
              scale: 0.1,
              rotation: Phaser.Math.FloatBetween(-Math.PI, Math.PI),
              duration: Phaser.Math.Between(300, 600),
              ease: 'Quad.easeOut',
              onComplete: () => p.destroy()
          });
      }

      // Extra ring for beams
      if (isBeam) {
          const ring = this.add.circle(x, y, 30).setStrokeStyle(4, color).setDepth(19);
          this.tweens.add({
              targets: ring,
              scale: 5,
              alpha: 0,
              duration: 400,
              ease: 'Cubic.easeOut',
              onComplete: () => ring.destroy()
          });
          
          // Beam specific screen flash and shake
          this.cameras.main.flash(150, 255, 255, 255, true);
          this.cameras.main.shake(300, 0.05);
      } else if (isBlock) {
          // Block specific shake
          this.cameras.main.shake(100, 0.01);
      } else {
          // Melee specific shake
          this.cameras.main.shake(150, 0.02);
      }
  }

  takeDamage(isP: boolean, dmg: number) {
      if(this.isBattleOver || !this.scene.isActive()) return;
      
      const def = isP ? this.playerDefending : this.enemyDefending;
      const target = isP ? this.player : this.enemy;
      
      if(def) {
          dmg = Math.floor(dmg * 0.3);
          // Block effect
          this.createImpactEffect(target.x, target.y, 0x3498db, 'block'); // Blue shield spark
          if(this.cache.audio.exists('sfx_block')) this.sound.play('sfx_block');
      } else {
          if(this.cache.audio.exists('sfx_hit')) this.sound.play('sfx_hit');
          
          // Hit pause (time freeze) for impact
          this.tweens.timeScale = 0;
          if (this.player.anims && this.player.anims.isPlaying) this.player.anims.pause();
          if (this.enemy.anims && this.enemy.anims.isPlaying) this.enemy.anims.pause();
          
          this.time.delayedCall(60, () => {
              if (this.scene && this.scene.isActive()) {
                  this.tweens.timeScale = 1;
                  if (this.player.anims && !this.player.anims.isPlaying) this.player.anims.resume();
                  if (this.enemy.anims && !this.enemy.anims.isPlaying) this.enemy.anims.resume();
              }
          }); // 60ms freeze
      }
      
      if(isP) this.playerHp = Math.max(0, this.playerHp - dmg);
      else this.enemyHp = Math.max(0, this.enemyHp - dmg);
      
      if(target.active) {
          target.setTintFill(0xffffff); // Initial white flash
          this.time.delayedCall(40, () => {
              if(target.active) target.setTint(0xff0000); // Then red
          });
          
          // Knockback / Shake effect
          const originalX = target.x;
          // Push back further if not defending
          const knockbackDist = def ? 10 : 30;
          const knockbackDir = isP ? -knockbackDist : knockbackDist;
          const rotDir = isP ? -0.1 : 0.1;
          
          this.tweens.add({
              targets: target,
              x: originalX + knockbackDir,
              rotation: def ? 0 : rotDir,
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
              this.performAttack(false, Math.random() > 0.5 ? 'melee' : 'ki');
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
              this.performAttack(false, Math.random() > 0.5 ? 'melee' : 'ki');
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
              this.performAttack(false, Math.random() > 0.5 ? 'melee' : 'ki');
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
          else this.performAttack(false, Math.random() > 0.5 ? 'melee' : 'ki');
      } else if (this.enemyKi >= 40) {
          // Medium Ki: Mix of Special, Attack, and Charge
          if (r < 0.4) this.performSpecial(false, false);
          else if (r < 0.7) this.performAttack(false, Math.random() > 0.5 ? 'melee' : 'ki');
          else this.performCharge(false);
      } else {
          // Low Ki: Favor Charging
          if (r < 0.7) this.performCharge(false);
          else this.performAttack(false, Math.random() > 0.5 ? 'melee' : 'ki');
      }
  }

  endBattle(win: boolean) {
      if(this.isBattleOver) return; // Prevent double call
      this.isBattleOver = true;
      if(this.turnTimer) this.turnTimer.remove();
      if(this.regenTimer) this.regenTimer.remove();
      
      this.add.rectangle(480, 270, 960, 540, 0x000000, 0.8).setDepth(20);
      
      let titleMessage = "DEFEAT...";
      let subtitleMessage = "";
      let color = '#e74c3c'; // Red
      let coinsEarned = 0;
      
      if (this.gameState.gameMode === 'local_pvp') {
          // PvP Outcome
          coinsEarned = 100;
          titleMessage = "CONGRATULATIONS!";
          color = '#f1c40f'; // Gold
          if (win) { // P1 Wins
              subtitleMessage = `${this.playerData.name.toUpperCase()} WINS!`;
          } else { // P2 Wins
              subtitleMessage = `${this.enemyData.name.toUpperCase()} WINS!`;
          }
          // Award coins in PvP regardless of who won (shared stash)
          this.gameState.coins += coinsEarned;
          window.UTLW.save();
      } else {
          // Single Player Outcome
          if (win) {
              titleMessage = "CONGRATULATIONS!";
              subtitleMessage = `${this.playerData.name.toUpperCase()} WINS!`;
              color = '#f1c40f'; // Gold
              coinsEarned = 100;
              this.gameState.coins += coinsEarned; 
              window.UTLW.save();
          } else {
              titleMessage = "DEFEAT...";
              subtitleMessage = `${this.enemyData.name.toUpperCase()} WINS!`;
              color = '#e74c3c'; // Red
              coinsEarned = 25; // Small consolation prize
              this.gameState.coins += coinsEarned;
              window.UTLW.save();
          }
      }

      // Display Title
      const titleText = this.add.text(480, -100, titleMessage, { 
          fontFamily: 'Impact, sans-serif',
          fontSize: '80px', 
          color: color, 
          fontStyle: 'italic',
          stroke: '#000',
          strokeThickness: 8
      }).setOrigin(0.5).setDepth(21);
      
      this.tweens.add({
          targets: titleText,
          y: 160,
          duration: 800,
          ease: 'Bounce.easeOut'
      });
      
      // Display Subtitle (Winner Name)
      if (subtitleMessage) {
          const subText = this.add.text(480, 260, subtitleMessage, { 
              fontFamily: 'Impact, sans-serif',
              fontSize: '56px', 
              color: '#ffffff',
              stroke: '#000',
              strokeThickness: 6
          }).setOrigin(0.5).setDepth(21).setAlpha(0).setScale(0.5);
          
          this.tweens.add({
              targets: subText,
              alpha: 1,
              scale: 1,
              duration: 500,
              delay: 600,
              ease: 'Back.easeOut'
          });
      }

      // Display Coins Earned
      if (coinsEarned > 0) {
          const coinText = this.add.text(480, 340, `REWARD: +${coinsEarned} COINS`, { 
              fontFamily: 'Impact, sans-serif',
              fontSize: '48px', 
              color: '#f1c40f',
              stroke: '#000',
              strokeThickness: 6
          }).setOrigin(0.5).setDepth(21).setAlpha(0);
          
          this.tweens.add({
              targets: coinText,
              alpha: 1,
              y: 360,
              duration: 400,
              delay: 1100,
              ease: 'Power2'
          });
      }
      
      const btn = this.add.text(480, 480, "RETURN TO MENU", { 
          fontFamily: 'Impact, sans-serif',
          fontSize: '36px',
          color: '#ffffff',
          backgroundColor: '#333333',
          padding: { x: 20, y: 10 }
      }).setOrigin(0.5).setDepth(21).setInteractive({ useHandCursor: true }).setAlpha(0);
      
      this.tweens.add({
          targets: btn,
          alpha: 1,
          duration: 400,
          delay: 1500
      });
      
      btn.on('pointerover', () => btn.setStyle({ color: '#f1c40f' }));
      btn.on('pointerout', () => btn.setStyle({ color: '#ffffff' }));
      btn.on('pointerdown', () => this.scene.start('MenuScene'));
  }
}
