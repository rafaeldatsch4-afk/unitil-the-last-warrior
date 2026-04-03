
import Phaser from 'phaser';
import { CharacterData } from '../types';
import { INITIAL_CHARACTERS } from '../data';

export default class PreloadScene extends Phaser.Scene {
  declare cameras: Phaser.Cameras.Scene2D.CameraManager;
  declare add: Phaser.GameObjects.GameObjectFactory;
  declare load: Phaser.Loader.LoaderPlugin;
  declare textures: Phaser.Textures.TextureManager;
  declare scene: Phaser.Scenes.ScenePlugin;
  declare make: Phaser.GameObjects.GameObjectCreator;
  declare sound: Phaser.Sound.NoAudioSoundManager | Phaser.Sound.HTML5AudioSoundManager | Phaser.Sound.WebAudioSoundManager;
  declare cache: Phaser.Cache.CacheManager;
  declare anims: Phaser.Animations.AnimationManager;

  constructor() {
    super('PreloadScene');
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // --- Loading UI ---
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);
    
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x1e293b, 1);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);
    
    const loadingText = this.add.text(width / 2, height / 2 - 60, 'Drawing Warriors...', {
      fontFamily: 'Arial', fontSize: '20px', color: '#e2e8f0', fontStyle: 'bold'
    }).setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xf59e0b, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      bg.destroy();
    });

    this.load.image('arena', 'https://labs.phaser.io/assets/skies/space3.png');
    this.load.image('arena_namek', 'https://labs.phaser.io/assets/skies/sky4.png');
    this.load.image('arena_city', 'https://labs.phaser.io/assets/skies/sunset.png');
    this.load.image('arena_tournament', 'https://labs.phaser.io/assets/skies/clouds.png');
  }

  create() {
    this.createAudioAssets();
    this.createFXAssets();

    // Load Characters
    const currentState = window.UTLW?.state;
    const chars = currentState && currentState.characters ? currentState.characters : INITIAL_CHARACTERS;

    chars.forEach(c => {
      // Base Form
      if (this.textures.exists(c.key)) {
          this.textures.remove(c.key);
          // Also remove anims to prevent stale references
          if(this.anims.exists(`${c.key}_idle`)) this.anims.remove(`${c.key}_idle`);
      }
      this.generateLSWSprite(c.key, 0);
      
      // Transformation
      if(c.transformAvailable) {
        const keySSJ = `${c.key}_ssj`;
        if (this.textures.exists(keySSJ)) {
            this.textures.remove(keySSJ);
            if(this.anims.exists(`${keySSJ}_idle`)) this.anims.remove(`${keySSJ}_idle`);
        }
        this.generateLSWSprite(c.key, 1);
        
        // Add UI/UE/Final transformation for Goku, Vegeta, and Naruto
        if (c.key === 'goku' || c.key === 'vegeta' || c.key === 'naruto') {
            const keyUI = `${c.key}_ui`;
            if (this.textures.exists(keyUI)) {
                this.textures.remove(keyUI);
                if(this.anims.exists(`${keyUI}_idle`)) this.anims.remove(`${keyUI}_idle`);
            }
            this.generateLSWSprite(c.key, 2);
        }
      }
    });

    // DUMMY Fallback for potential missing assets
    if(!this.textures.exists('dummy')) {
        const g = this.make.graphics({x:0,y:0});
        g.fillStyle(0x555555); g.fillRect(0,0,32,32);
        g.generateTexture('dummy', 32, 32);
        g.destroy();
    }

    this.scene.start('MenuScene');
  }

  createFXAssets() {
    // Energy Ball
    const p = this.make.graphics({ x: 0, y: 0 });
    p.fillStyle(0xffffff, 1); p.fillCircle(8, 8, 8);
    p.fillStyle(0xaaeeff, 1); p.fillCircle(8, 8, 5);
    p.generateTexture('particle', 16, 16);
    p.destroy();

    // Massive Beam (Father-Son Kamehameha)
    const mb = this.make.graphics({ x: 0, y: 0 });
    // Core
    mb.fillStyle(0xffffff, 1);
    mb.fillRect(0, 10, 128, 44);
    // Outer Aura
    mb.fillStyle(0x00ffff, 0.6);
    mb.fillRect(0, 0, 128, 64);
    mb.generateTexture('massive_beam', 128, 64);
    mb.destroy();

    // Mechanical Spark (For Optimus)
    const sp = this.make.graphics({ x: 0, y: 0 });
    sp.fillStyle(0xffaa00, 1); sp.fillRect(0, 0, 4, 4);
    sp.fillStyle(0xffffff, 1); sp.fillRect(1, 1, 2, 2);
    sp.generateTexture('mech_spark', 4, 4);
    sp.destroy();

    // Missile
    const m = this.make.graphics({ x: 0, y: 0 });
    m.fillStyle(0x555555, 1); m.fillRect(0, 6, 24, 10); // Body
    m.fillStyle(0xff0000, 1); m.fillTriangle(24, 6, 24, 16, 32, 11); // Head
    m.fillStyle(0xffaa00, 1); m.fillTriangle(0, 6, 0, 16, -8, 11); // Fire
    m.generateTexture('missile', 40, 22);
    m.destroy();

    // Shuriken
    const s = this.make.graphics({ x: 0, y: 0 });
    s.fillStyle(0xcccccc, 1);
    s.fillTriangle(16, 0, 20, 16, 12, 16);
    s.fillTriangle(16, 32, 20, 16, 12, 16);
    s.fillTriangle(0, 16, 16, 12, 16, 20);
    s.fillTriangle(32, 16, 16, 12, 16, 20);
    s.fillStyle(0x222222, 1); s.fillCircle(16, 16, 2);
    s.generateTexture('shuriken', 32, 32);
    s.destroy();

    // Batarang
    const b = this.make.graphics({ x: 0, y: 0 });
    b.fillStyle(0x111111, 1);
    b.fillTriangle(16, 16, 32, 8, 24, 24);
    b.fillTriangle(16, 16, 0, 8, 8, 24);
    b.generateTexture('batarang', 32, 32);
    b.destroy();
  }

  createAudioAssets() {
    // Check if sound manager is unlocked/available before creating context-dependent audio
    const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (!soundManager.context) return;
    
    // Helper to synthesize sound
    const generateSynthSound = (name: string, duration: number, type: 'square'|'sawtooth'|'sine'|'triangle', freqStart: number, freqEnd: number, vol: number = 0.5) => {
        try {
            const ctx = soundManager.context;
            const sampleRate = ctx.sampleRate;
            const frameCount = duration * sampleRate;
            const buffer = ctx.createBuffer(1, frameCount, sampleRate);
            const data = buffer.getChannelData(0);
            
            for (let i = 0; i < frameCount; i++) {
                const t = i / sampleRate;
                const progress = i / frameCount;
                const currentFreq = freqStart + (freqEnd - freqStart) * progress;
                
                let val = 0;
                const phase = t * currentFreq * 2 * Math.PI;
                
                if(type === 'sine') val = Math.sin(phase);
                else if(type === 'square') val = Math.sin(phase) > 0 ? 1 : -1;
                else if(type === 'sawtooth') val = (t * currentFreq) % 1 * 2 - 1;
                else if(type === 'triangle') val = Math.abs((t * currentFreq) % 1 * 4 - 2) - 1;

                // Envelope
                const envelope = 1 - Math.pow(progress, 2);
                data[i] = val * vol * envelope;
            }
            this.cache.audio.add(name, buffer);
        } catch (e) {
            console.warn("Audio synthesis failed", e);
        }
    };

    // Generate SFX
    generateSynthSound('sfx_select', 0.1, 'sine', 800, 1200, 0.3);
    generateSynthSound('sfx_attack', 0.1, 'square', 200, 50, 0.5);
    generateSynthSound('sfx_hit', 0.15, 'sawtooth', 150, 50, 0.6);
    generateSynthSound('sfx_block', 0.1, 'sine', 400, 300, 0.4);
    generateSynthSound('sfx_beam', 1.0, 'sawtooth', 400, 100, 0.3);
    generateSynthSound('sfx_transform', 1.5, 'square', 100, 300, 0.4);
    generateSynthSound('sfx_transform_mech', 1.5, 'sawtooth', 50, 600, 0.6);
    generateSynthSound('sfx_error', 0.2, 'sawtooth', 150, 100, 0.4);

    // Generate Simple Looping BGM
    const generateLoop = (name: string, pattern: number[]) => {
         try {
             const ctx = soundManager.context;
             const tempo = 0.2; // seconds per note
             const totalDur = pattern.length * tempo;
             const buffer = ctx.createBuffer(1, totalDur * ctx.sampleRate, ctx.sampleRate);
             const data = buffer.getChannelData(0);
             
             for(let i=0; i<data.length; i++) {
                 const t = i / ctx.sampleRate;
                 const noteIdx = Math.floor(t / tempo);
                 const freq = pattern[noteIdx];
                 if(freq > 0) {
                     const v = (Math.sin(t * freq * 2 * Math.PI) > 0 ? 1 : -1) * 0.1;
                     data[i] = v * (1 - ((t % tempo)/tempo)); // Decay
                 }
             }
             this.cache.audio.add(name, buffer);
         } catch(e) {
             console.warn("BGM generation failed", e);
         }
    };

    generateLoop('bgm_menu', [220, 0, 220, 261, 329, 0, 261, 0]); 
    generateLoop('bgm_battle', [110, 110, 130, 110, 146, 110, 164, 110, 82, 82, 98, 82, 110, 82, 130, 82]);
  }

  // =================================================================================
  // PIXEL ART ENGINE (32x32 GRID SCALED 2x) - LSW / POWER WARRIORS STYLE
  // GENERATES A 4-FRAME SPRITESHEET
  // =================================================================================
  generateLSWSprite(key: string, form: number) {
    const isTransformed = form > 0;
    const isUI = form === 2;
    const SCALE = 2;
    const FRAME_WIDTH = 32;
    const FRAME_HEIGHT = 64; // Taller frame to support big hair
    const DRAW_OFFSET_Y = 32; // Shift body down so feet are at bottom of 64px frame
    const FRAMES = 6;
    
    // Calculate total dimensions
    const sheetWidth = FRAME_WIDTH * SCALE * FRAMES;
    const sheetHeight = FRAME_HEIGHT * SCALE;

    const canvas = this.make.graphics({ x: 0, y: 0 });
    
    // Loop to draw 6 frames side by side
    for(let f = 0; f < FRAMES; f++) {
        const offsetX = f * FRAME_WIDTH;
        const isAttack = f >= 4;
        
        // ANIMATION LOGIC: Breathing / Bobbing
        // Note: y coordinates below 22 are bobbed. DRAW_OFFSET_Y is added to final position.
        const breatheOffset = (!isAttack && (f === 1 || f === 3)) ? 1 : 0;
        
        // Attack pose offsets
        const attackOffsetX = (f === 4) ? 2 : (f === 5) ? 4 : 0;
        const attackOffsetY = (f === 4) ? -1 : (f === 5) ? -2 : 0;
        
        const dot = (x: number, y: number, color: number) => {
            const finalY = (y < 22) ? y + breatheOffset : y;
            const finalX = isAttack ? x + attackOffsetX / 2 : x;
            const finalYAttack = isAttack ? finalY + attackOffsetY / 2 : finalY;
            canvas.fillStyle(color, 1);
            canvas.fillRect((offsetX + finalX) * SCALE, (finalYAttack + DRAW_OFFSET_Y) * SCALE, SCALE, SCALE);
        };

        const box = (x: number, y: number, w: number, h: number, color: number) => {
            const finalY = (y < 22) ? y + breatheOffset : y;
            const finalX = isAttack ? x + attackOffsetX / 2 : x;
            const finalYAttack = isAttack ? finalY + attackOffsetY / 2 : finalY;
            canvas.fillStyle(color, 1);
            canvas.fillRect((offsetX + finalX) * SCALE, (finalYAttack + DRAW_OFFSET_Y) * SCALE, w * SCALE, h * SCALE);
        };

        const headBox = (x: number, y: number, w: number, h: number, color: number) => {
            const finalX = isAttack ? x + attackOffsetX / 2 : x;
            const finalYAttack = isAttack ? y + attackOffsetY / 2 : y;
            canvas.fillStyle(color, 1);
            canvas.fillRect((offsetX + finalX) * SCALE, (finalYAttack + breatheOffset + DRAW_OFFSET_Y) * SCALE, w * SCALE, h * SCALE);
        };
        const headDot = (x: number, y: number, color: number) => {
            const finalX = isAttack ? x + attackOffsetX / 2 : x;
            const finalYAttack = isAttack ? y + attackOffsetY / 2 : y;
            canvas.fillStyle(color, 1);
            canvas.fillRect((offsetX + finalX) * SCALE, (finalYAttack + breatheOffset + DRAW_OFFSET_Y) * SCALE, SCALE, SCALE);
        };

        const SKIN = 0xffcc99;
        const WHITE = 0xffffff;
        const BLACK = 0x111111;

        switch(key) {
            case 'goku': {
                // DBZ PALETTE
                const GI_ORANGE = 0xff5a00; // Vibrant orange
                const GI_SHADOW = 0xcc3300;
                const GI_BLUE = 0x003399;   // Vibrant blue
                const SASH_BLUE = 0x003399;
                const SKIN_TONE = 0xffce9e; 
                const SKIN_SHADOW = 0xe0ac7d;
                const BOOT_RED = 0xd92525;
                const BOOT_ROPE = 0xeaddcf;
                const HAIR_BLACK = 0x1a1a1a; 
                
                // SSJ PALETTE
                const HAIR_SSJ_GOLD = 0xffea00; // Vibrant gold
                const HAIR_SSJ_SHADOW = 0xd4a000;
                const HAIR_SSJ_LIGHT = 0xfff599;
                const EYE_SSJ_TEAL = 0x00f2ff;

                // ULTRA INSTINCT PALETTE
                const HAIR_UI_SILVER = 0xe0e0e0; 
                const HAIR_UI_SHADOW = 0x9e9e9e;
                const HAIR_UI_LIGHT = 0xffffff;
                const EYE_UI_SILVER = 0xcccccc;

                let hairColor = HAIR_BLACK;
                let eyeColor = 0x111111;
                let eyebrowColor = HAIR_BLACK;

                if (isUI) {
                    hairColor = HAIR_UI_SILVER;
                    eyeColor = EYE_UI_SILVER;
                    eyebrowColor = HAIR_UI_SHADOW;
                } else if (isTransformed) {
                    hairColor = HAIR_SSJ_GOLD;
                    eyeColor = EYE_SSJ_TEAL;
                    eyebrowColor = HAIR_SSJ_SHADOW;
                }

                // --- BODY ---
                // Legs
                box(10, 23, 4, 6, GI_ORANGE); box(18, 23, 4, 6, GI_ORANGE);
                // Gi folds on legs
                box(10, 23, 1, 6, GI_SHADOW); box(21, 23, 1, 6, GI_SHADOW);
                box(12, 24, 1, 4, GI_SHADOW); box(19, 24, 1, 4, GI_SHADOW);
                // Boots (Classic Z style)
                box(10, 29, 4, 3, GI_BLUE); box(18, 29, 4, 3, GI_BLUE);
                box(10, 29, 4, 1, BOOT_ROPE); box(18, 29, 4, 1, BOOT_ROPE);
                box(12, 29, 1, 3, BOOT_RED); box(20, 29, 1, 3, BOOT_RED); // Vertical stripe
                box(10, 31, 4, 1, GI_BLUE); box(18, 31, 4, 1, GI_BLUE);
                // Boot shadows
                box(10, 30, 1, 2, 0x001133); box(18, 30, 1, 2, 0x001133);

                // Torso
                box(11, 14, 10, 9, GI_ORANGE);
                box(13, 14, 6, 4, GI_BLUE); // Undershirt
                // Undershirt shadow
                box(13, 14, 1, 4, 0x001133); box(18, 14, 1, 4, 0x001133);
                box(14, 14, 4, 2, SKIN_TONE); // Neck
                // Neck shadow
                box(14, 15, 4, 1, SKIN_SHADOW);
                dot(15, 16, SKIN_TONE); // V-neck dip
                // Gi folds on torso
                box(19, 17, 2, 6, GI_SHADOW); // Shading right
                box(11, 17, 1, 5, GI_SHADOW); // Shading left
                box(14, 18, 1, 4, GI_SHADOW); box(17, 18, 1, 4, GI_SHADOW); // Inner folds
                box(12, 19, 8, 1, GI_SHADOW); // Horizontal fold

                // Sash with knot
                box(11, 22, 10, 2, SASH_BLUE);
                // Sash shadow
                box(11, 23, 10, 1, 0x001133);
                const knotY = (f % 2 === 0) ? 23 : 24; 
                box(11, 23, 2, 4, SASH_BLUE); dot(12, 27, SASH_BLUE);
                box(11, 24, 1, 3, 0x001133); // Knot shadow

                if (!isUI) {
                    // Kanji Symbol (Turtle/Kai)
                    box(17, 16, 3, 3, 0xffffff); dot(18, 17, 0x111111);
                }

                // Arms (Wristbands)
                box(8, 14, 3, 4, GI_ORANGE); box(21, 14, 3, 4, GI_ORANGE);
                // Shoulder gi folds
                box(8, 15, 1, 3, GI_SHADOW); box(23, 15, 1, 3, GI_SHADOW);
                
                box(8, 18, 3, 3, SKIN_TONE); box(21, 18, 3, 3, SKIN_TONE);
                // Arm muscle shading
                box(8, 18, 1, 3, SKIN_SHADOW); box(23, 18, 1, 3, SKIN_SHADOW);
                box(9, 19, 1, 2, SKIN_SHADOW); box(22, 19, 1, 2, SKIN_SHADOW); // Bicep definition
                
                box(8, 20, 3, 3, GI_BLUE); box(21, 20, 3, 3, GI_BLUE); // Wristband
                // Wristband shadow
                box(8, 20, 1, 3, 0x001133); box(23, 20, 1, 3, 0x001133);
                
                box(8, 23, 3, 2, SKIN_TONE); box(21, 23, 3, 2, SKIN_TONE); // Hands
                // Knuckles
                box(8, 24, 3, 1, SKIN_SHADOW); box(21, 24, 3, 1, SKIN_SHADOW);

                // Head
                headBox(12, 6, 8, 7, SKIN_TONE);
                headDot(11, 9, SKIN_TONE); headDot(20, 9, SKIN_TONE); // Ears
                headDot(11, 10, SKIN_SHADOW); headDot(20, 10, SKIN_SHADOW); // Ear shadows
                headBox(13, 12, 6, 1, SKIN_SHADOW); // Jaw shadow
                
                // Face
                headDot(13, 9, WHITE); headDot(18, 9, WHITE); 
                headDot(14, 9, eyeColor); headDot(17, 9, eyeColor);
                headDot(13, 8, eyebrowColor); headDot(14, 8, eyebrowColor);
                headDot(17, 8, eyebrowColor); headDot(18, 8, eyebrowColor);
                // Angry brow furrow
                headDot(15, 8, SKIN_SHADOW); headDot(16, 8, SKIN_SHADOW);
                headDot(15, 11, 0xdca880); // Nose
                // Cheek lines (iconic DBZ style)
                headDot(13, 11, SKIN_SHADOW); headDot(18, 11, SKIN_SHADOW);

                canvas.fillStyle(hairColor, 1);
                
                if (isTransformed && !isUI) {
                    // SSJ Hair - Standing straight up, dynamic flame-like
                    headBox(11, 0, 10, 6, hairColor); // Main block
                    // Left side spikes
                    headBox(9, -2, 2, 6, hairColor); 
                    headBox(7, 0, 2, 4, hairColor);
                    // Right side spikes
                    headBox(21, -2, 2, 6, hairColor);
                    headBox(23, 0, 2, 4, hairColor);
                    // Top spikes (tall and sharp)
                    headBox(11, -6, 2, 6, hairColor); // Far left top
                    headBox(14, -8, 3, 8, hairColor); // Center top (tallest)
                    headBox(18, -5, 2, 5, hairColor); // Far right top
                    
                    // Hair shading
                    headBox(11, -2, 1, 6, HAIR_SSJ_SHADOW); headBox(20, -2, 1, 6, HAIR_SSJ_SHADOW);
                    headBox(12, -6, 1, 6, HAIR_SSJ_SHADOW); headBox(18, -5, 1, 5, HAIR_SSJ_SHADOW);
                    headBox(15, -8, 1, 8, HAIR_SSJ_SHADOW); // Middle spike shadow
                    // Hair highlights
                    headBox(13, -4, 1, 4, HAIR_SSJ_LIGHT); headBox(19, -3, 1, 4, HAIR_SSJ_LIGHT);
                    headBox(16, -6, 1, 4, HAIR_SSJ_LIGHT);
                    // Bangs (SSJ has fewer bangs, mostly one or two sharp ones, lifted)
                    headBox(14, 6, 2, 2, hairColor);
                    headBox(17, 6, 1, 1, hairColor);
                    headBox(14, 7, 1, 1, HAIR_SSJ_SHADOW); // Bang shadow
                } else if (isUI) {
                    // UI Hair - Similar to base but more raised/flowing
                    headBox(11, 1, 10, 7, hairColor); 
                    headBox(14, -1, 4, 3, hairColor); // Top bump
                    headBox(9, 2, 2, 5, hairColor); headDot(8, 4, hairColor);
                    headBox(7, 3, 2, 4, hairColor);
                    headBox(21, 2, 2, 4, hairColor); headDot(23, 4, hairColor);
                    // Hair shading
                    headBox(11, 3, 1, 5, HAIR_UI_SHADOW); headBox(20, 3, 1, 5, HAIR_UI_SHADOW);
                    headBox(14, 1, 1, 3, HAIR_UI_SHADOW);
                    // Hair highlights
                    headBox(12, 2, 1, 4, HAIR_UI_LIGHT); headBox(19, 2, 1, 4, HAIR_UI_LIGHT);
                    headBox(15, 0, 1, 3, HAIR_UI_LIGHT);
                    // Bangs
                    headBox(13, 6, 2, 3, hairColor);
                    headBox(16, 6, 3, 3, hairColor);
                    headBox(11, 6, 1, 2, hairColor);
                    headBox(20, 6, 1, 2, hairColor);
                    headBox(13, 7, 1, 2, HAIR_UI_SHADOW); headBox(17, 7, 1, 2, HAIR_UI_SHADOW); // Bang shadows
                } else {
                    // Base Hair - Classic Goku (Palm tree look)
                    headBox(11, 1, 10, 5, hairColor); // Main base
                    // Top spikes
                    headBox(13, -2, 3, 3, hairColor); 
                    headBox(16, -1, 3, 2, hairColor); 
                    // Left spikes (curving up and out)
                    headBox(9, 0, 2, 4, hairColor);
                    headBox(7, 1, 2, 3, hairColor);
                    headBox(5, 3, 2, 2, hairColor);
                    // Right spikes (curving up and out)
                    headBox(21, 1, 2, 4, hairColor);
                    headBox(23, 2, 2, 3, hairColor);
                    headBox(25, 4, 2, 2, hairColor);
                    // Hair shading (greyish for black hair)
                    headBox(12, 2, 1, 4, 0x333333); headBox(19, 2, 1, 4, 0x333333);
                    headBox(14, 0, 1, 2, 0x333333);
                    // Bangs (Base) - Lifted
                    headBox(13, 6, 2, 2, hairColor); // Left bang
                    headBox(16, 6, 2, 2, hairColor); // Right bang
                    headBox(18, 6, 1, 1, hairColor); // Small side bang
                }
                
                break;
            }
            case 'vegeta': {
                const SUIT_BLUE = 0x1a2a6c; const SUIT_SHADOW = 0x111b44; const SUIT_LIGHT = 0x2a3a8c;
                const ARMOR_WHITE = 0xfbfbfb; const ARMOR_SHADOW = 0xd0d0d0; const ARMOR_DARK = 0xa0a0a0;
                const GOLD = 0xffd700; const GOLD_SHADOW = 0xccaa00;
                
                let HAIR = BLACK;
                let EYE = BLACK;
                let BROW = BLACK;
                if (isUI) { // Ultra Ego
                    HAIR = 0x9b59b6; // Purple
                    EYE = 0xff00ff; // Magenta
                    BROW = 0xe0ac7d; // No eyebrows, just brow ridge
                } else if (isTransformed) { // SSJ
                    HAIR = 0xffe14c;
                    EYE = 0x00e5bb;
                    BROW = 0xffe14c;
                }
                
                // Legs (more shaped, tapering down)
                box(11, 23, 4, 6, SUIT_BLUE); box(17, 23, 4, 6, SUIT_BLUE); // Thighs
                box(12, 23, 2, 6, SUIT_LIGHT); box(18, 23, 2, 6, SUIT_LIGHT); // Thigh highlights
                // Suit shading on legs (Ribbed texture)
                box(11, 23, 1, 6, SUIT_SHADOW); box(20, 23, 1, 6, SUIT_SHADOW);
                box(14, 24, 1, 4, SUIT_SHADOW); box(17, 24, 1, 4, SUIT_SHADOW); // Inner leg shadow
                // Ribbed horizontal lines
                box(11, 24, 4, 1, SUIT_SHADOW); box(17, 24, 4, 1, SUIT_SHADOW);
                box(11, 26, 4, 1, SUIT_SHADOW); box(17, 26, 4, 1, SUIT_SHADOW);
                
                // Boots (pointed tips, rounded tops)
                box(11, 28, 4, 3, ARMOR_WHITE); box(17, 28, 4, 3, ARMOR_WHITE);
                box(10, 30, 5, 2, ARMOR_WHITE); box(17, 30, 5, 2, ARMOR_WHITE);
                box(10, 31, 5, 1, GOLD); box(17, 31, 5, 1, GOLD);
                dot(10, 30, GOLD); dot(14, 30, GOLD); dot(17, 30, GOLD); dot(21, 30, GOLD); // Gold tips shape
                box(12, 28, 2, 3, ARMOR_SHADOW); box(18, 28, 2, 3, ARMOR_SHADOW); // Boot shadow
                // Boot folds
                box(11, 29, 4, 1, ARMOR_SHADOW); box(17, 29, 4, 1, ARMOR_SHADOW);
                box(10, 32, 5, 1, 0x000000); box(17, 32, 5, 1, 0x000000); // Sole shadow
                
                // Torso (Suit underneath)
                box(12, 19, 8, 5, SUIT_BLUE);
                box(13, 19, 6, 5, SUIT_LIGHT);
                // Suit shading on torso
                box(12, 19, 1, 5, SUIT_SHADOW); box(19, 19, 1, 5, SUIT_SHADOW);
                box(14, 20, 4, 1, SUIT_SHADOW); // Ab shadow
                
                // Armor (Chest piece)
                box(11, 14, 10, 5, ARMOR_WHITE); // Main chest
                box(12, 17, 8, 2, ARMOR_SHADOW); // Abdomen segments
                box(11, 14, 2, 5, GOLD); box(19, 14, 2, 5, GOLD); // Straps/Side gold
                // Gold shading
                box(11, 14, 1, 5, GOLD_SHADOW); box(20, 14, 1, 5, GOLD_SHADOW);
                // Chest lines (Pectorals and Abs)
                box(13, 15, 6, 1, ARMOR_DARK); // Pectoral line
                box(15, 15, 2, 4, ARMOR_DARK); // Center ab line
                box(13, 17, 6, 1, ARMOR_DARK); // Ab horizontal line 1
                box(13, 18, 6, 1, ARMOR_DARK); // Ab horizontal line 2
                // Armor highlights
                box(14, 14, 4, 1, 0xffffff);
                box(12, 18, 8, 1, ARMOR_DARK); // Lower armor shadow
                
                // Shoulders (Iconic pointy pads)
                box(7, 13, 4, 2, GOLD); box(6, 14, 5, 2, ARMOR_WHITE);
                dot(6, 13, GOLD); dot(5, 14, ARMOR_WHITE); // Left tip
                box(21, 13, 4, 2, GOLD); box(21, 14, 5, 2, ARMOR_WHITE);
                dot(25, 13, GOLD); dot(26, 14, ARMOR_WHITE); // Right tip
                // Shoulder pad shading & highlights
                box(6, 15, 5, 1, ARMOR_SHADOW); box(21, 15, 5, 1, ARMOR_SHADOW);
                box(7, 14, 4, 1, GOLD_SHADOW); box(21, 14, 4, 1, GOLD_SHADOW);
                box(7, 14, 2, 1, 0xffffff); box(23, 14, 2, 1, 0xffffff); // White pad highlights
                
                // Arms
                box(8, 16, 3, 4, SUIT_BLUE); box(21, 16, 3, 4, SUIT_BLUE);
                // Arm shading (Ribbed texture)
                box(8, 16, 1, 4, SUIT_SHADOW); box(23, 16, 1, 4, SUIT_SHADOW);
                box(9, 17, 1, 2, SUIT_SHADOW); box(22, 17, 1, 2, SUIT_SHADOW); // Bicep definition
                box(8, 17, 3, 1, SUIT_SHADOW); box(21, 17, 3, 1, SUIT_SHADOW); // Ribbed line 1
                box(8, 19, 3, 1, SUIT_SHADOW); box(21, 19, 3, 1, SUIT_SHADOW); // Ribbed line 2
                
                // Gloves
                box(7, 20, 4, 4, ARMOR_WHITE); box(21, 20, 4, 4, ARMOR_WHITE);
                box(8, 20, 2, 4, ARMOR_SHADOW); box(22, 20, 2, 4, ARMOR_SHADOW);
                // Glove folds
                box(7, 21, 4, 1, ARMOR_SHADOW); box(21, 21, 4, 1, ARMOR_SHADOW);
                box(7, 23, 4, 1, ARMOR_DARK); box(21, 23, 4, 1, ARMOR_DARK); // Knuckle shadow
                
                // Head/Face (Less blocky)
                headBox(12, 5, 8, 7, SKIN); // Face base
                headBox(13, 12, 6, 1, SKIN); // Chin
                // Face shading
                headBox(12, 6, 1, 5, 0xe0ac7d); headBox(19, 6, 1, 5, 0xe0ac7d); // Side shadows
                headBox(13, 12, 6, 1, 0xe0ac7d); // Jaw shadow
                
                // Eyes & Brow
                headBox(13, 8, 2, 1, WHITE); headBox(17, 8, 2, 1, WHITE); // Whites
                headDot(14, 8, EYE); headDot(17, 8, EYE); // Pupils
                headBox(12, 7, 3, 1, BROW); headBox(17, 7, 3, 1, BROW); // Angry brows
                headDot(14, 7, SKIN); headDot(17, 7, SKIN); // Angle the brows
                // Angry brow furrow
                headDot(15, 7, 0xe0ac7d); headDot(16, 7, 0xe0ac7d);
                // Cheek lines
                headDot(13, 10, 0xe0ac7d); headDot(18, 10, 0xe0ac7d);
                
                // Hair (Vegeta's flame shape & widow's peak)
                headBox(11, 1, 10, 4, HAIR); // Base width
                headBox(12, -2, 8, 3, HAIR); // Mid section
                headBox(13, -5, 6, 3, HAIR); // Upper mid
                headBox(14, -8, 4, 3, HAIR); // Top peak
                
                // Side flame spikes
                headBox(10, 0, 2, 3, HAIR); headDot(9, -1, HAIR); // Left lower
                headBox(11, -3, 2, 3, HAIR); headDot(10, -4, HAIR); // Left mid
                headBox(12, -6, 2, 3, HAIR); headDot(11, -7, HAIR); // Left upper
                
                headBox(20, 0, 2, 3, HAIR); headDot(22, -1, HAIR); // Right lower
                headBox(19, -3, 2, 3, HAIR); headDot(21, -4, HAIR); // Right mid
                headBox(18, -6, 2, 3, HAIR); headDot(20, -7, HAIR); // Right upper
                
                // Widow's peak (Deep M shape)
                headDot(15, 5, HAIR); headDot(16, 5, HAIR); // Center point
                headDot(14, 4, HAIR); headDot(17, 4, HAIR); // Inner slope
                headDot(13, 3, HAIR); headDot(18, 3, HAIR); // Outer slope
                headDot(12, 4, HAIR); headDot(19, 4, HAIR); // Sideburns top
                headDot(12, 5, HAIR); headDot(19, 5, HAIR); // Sideburns mid
                headDot(12, 6, HAIR); headDot(19, 6, HAIR); // Sideburns bottom
                
                // Hair shading (if SSJ)
                if (isTransformed) {
                    const hairShadow = isUI ? 0x732d91 : 0xd4a000;
                    headBox(11, 1, 1, 4, hairShadow); headBox(20, 1, 1, 4, hairShadow);
                    headBox(12, -2, 1, 3, hairShadow); headBox(19, -2, 1, 3, hairShadow);
                    headBox(13, -5, 1, 3, hairShadow); headBox(18, -5, 1, 3, hairShadow);
                    headBox(14, -8, 1, 3, hairShadow); headBox(17, -8, 1, 3, hairShadow);
                }
                // Hair shading
                headBox(12, 2, 1, 3, 0x333333); headBox(19, 2, 1, 3, 0x333333);
                headBox(14, 0, 1, 2, 0x333333); headBox(17, 0, 1, 2, 0x333333); // Inner spikes shadow
                
                if (isTransformed) {
                    // Taller, spikier hair for SSJ/UE
                    headBox(12, 0, 8, 5, HAIR);
                    headBox(13, -2, 6, 2, HAIR);
                    headDot(14, -3, HAIR); headDot(17, -3, HAIR);
                    headDot(10, 2, HAIR); headDot(21, 2, HAIR);
                    // SSJ/UE Hair shading
                    const hairShadowColor = isUI ? 0x6c3483 : GOLD_SHADOW;
                    const hairLightColor = isUI ? 0xd2b4de : 0xffffaa;
                    headBox(12, 0, 1, 5, hairShadowColor); headBox(19, 0, 1, 5, hairShadowColor);
                    headBox(13, -2, 1, 2, hairShadowColor); headBox(18, -2, 1, 2, hairShadowColor);
                    // Hair highlights
                    headBox(14, -1, 1, 3, hairLightColor); headBox(17, -1, 1, 3, hairLightColor);
                }
                break;
            }
            case 'piccolo': {
                // Brighter green skin, darker purple gi for DBS look
                const GREEN_SKIN = 0x66e044; const GREEN_SHADOW = 0x3b9e23; 
                const MUSCLE_PINK = 0xf08090; const MUSCLE_SHADOW = 0xc05060;
                const GI_PURPLE = 0x2a164d; const GI_SHADOW = 0x150b26; 
                const SASH_BLUE = 0x2980b9; const SHOE_BROWN = 0x6b4a23; 
                const WHITE_CAPE = 0xf8f8f8; const CAPE_SHADOW = 0xdcdcdc; 
                const ORANGE_SKIN = 0xff9900; const ORANGE_SHADOW = 0xcc7700; 
                const RED_EYES = 0xff0000;
                
                const skin = isTransformed ? ORANGE_SKIN : GREEN_SKIN; 
                const skinShadow = isTransformed ? ORANGE_SHADOW : GREEN_SHADOW; 
                const eyeColor = isTransformed ? RED_EYES : BLACK;

                // Legs
                box(10, 23, 4, 7, GI_PURPLE); box(18, 23, 4, 7, GI_PURPLE); 
                // Gi folds/shadows on legs
                box(10, 23, 1, 7, GI_SHADOW); box(21, 23, 1, 7, GI_SHADOW); 
                box(12, 24, 1, 5, GI_SHADOW); box(19, 24, 1, 5, GI_SHADOW); // Extra folds
                // Shoes
                box(10, 30, 4, 2, SHOE_BROWN); box(18, 30, 4, 2, SHOE_BROWN); 
                dot(11, 30, 0x4a3010); dot(12, 30, 0x4a3010); 
                
                // Torso
                if (isTransformed) {
                    // Bulkier torso for Orange Piccolo
                    box(10, 14, 12, 9, GI_PURPLE); 
                    // Gi folds
                    box(11, 15, 1, 6, GI_SHADOW); box(20, 15, 1, 6, GI_SHADOW);
                    box(13, 17, 1, 4, GI_SHADOW); box(18, 17, 1, 4, GI_SHADOW);
                    
                    box(10, 21, 12, 3, SASH_BLUE); 
                    box(14, 22, 4, 2, 0x1f618d); 
                    box(12, 13, 8, 3, skin); // Exposed chest
                    // Chest muscle definition
                    box(15, 14, 2, 2, skinShadow); // Cleavage
                    box(13, 15, 2, 1, skinShadow); box(17, 15, 2, 1, skinShadow); // Pecs lower line
                } else {
                    box(11, 14, 10, 9, GI_PURPLE); 
                    // Gi folds
                    box(12, 15, 1, 6, GI_SHADOW); box(19, 15, 1, 6, GI_SHADOW);
                    box(14, 17, 1, 4, GI_SHADOW); box(17, 17, 1, 4, GI_SHADOW);
                    
                    box(11, 21, 10, 3, SASH_BLUE); 
                    box(14, 22, 4, 2, 0x1f618d); 
                    box(13, 13, 6, 3, skin);
                    // Chest muscle definition
                    box(15, 14, 2, 2, skinShadow); // Cleavage
                }

                // Arms
                if (isTransformed) {
                    // Bulkier arms
                    box(5, 15, 5, 9, skin); box(22, 15, 5, 9, skin);
                    // Muscle lines (Orange Piccolo has distinct arm lines)
                    box(6, 17, 3, 1, skinShadow); box(6, 20, 3, 1, skinShadow);
                    box(23, 17, 3, 1, skinShadow); box(23, 20, 3, 1, skinShadow);
                    // Bicep/Tricep definition
                    box(5, 16, 1, 3, skinShadow); box(9, 16, 1, 3, skinShadow);
                    box(22, 16, 1, 3, skinShadow); box(26, 16, 1, 3, skinShadow);
                    // Wristbands
                    box(5, 22, 4, 2, 0xbb3333); box(23, 22, 4, 2, 0xbb3333); 
                    // Hands
                    box(5, 24, 4, 3, skin); box(23, 24, 4, 3, skin); 
                    // Knuckles
                    box(5, 26, 4, 1, skinShadow); box(23, 26, 4, 1, skinShadow);
                } else {
                    box(7, 15, 4, 8, skin); box(21, 15, 4, 8, skin); 
                    // Refined muscle patches
                    const patchColor = MUSCLE_PINK; 
                    box(8, 16, 2, 3, patchColor); box(8, 16, 1, 3, MUSCLE_SHADOW);
                    box(22, 16, 2, 3, patchColor); box(23, 16, 1, 3, MUSCLE_SHADOW);
                    // Bicep/Tricep definition
                    box(7, 16, 1, 3, skinShadow); box(10, 16, 1, 3, skinShadow);
                    box(21, 16, 1, 3, skinShadow); box(24, 16, 1, 3, skinShadow);
                    // Wristbands
                    box(8, 21, 3, 2, 0xbb3333); box(21, 21, 3, 2, 0xbb3333); 
                    // Hands
                    box(8, 23, 3, 2, skin); box(21, 23, 3, 2, skin); 
                    // Knuckles
                    box(8, 24, 3, 1, skinShadow); box(21, 24, 3, 1, skinShadow);
                }

                // Head
                if (isTransformed) {
                    // Bulkier head, prominent jaw
                    headBox(11, 5, 10, 8, skin); 
                    headBox(11, 8, 10, 2, skinShadow); // Brow shadow
                    // Distinctive antennae (taller and thicker)
                    headBox(12, 3, 2, 2, skin); headBox(13, 1, 1, 2, skin);
                    headBox(18, 3, 2, 2, skin); headBox(18, 1, 1, 2, skin);
                } else {
                    headBox(12, 6, 8, 7, skin); 
                    headBox(12, 8, 8, 1, skinShadow); // Brow shadow
                }

                // Facial features
                const hx = isTransformed ? 11 : 12;
                const hw = isTransformed ? 10 : 8;
                headDot(hx+1, 12, skinShadow); headDot(hx+2, 12, skinShadow); // Cheek lines
                headDot(hx+hw-2, 12, skinShadow); headDot(hx+hw-3, 12, skinShadow); // Cheek lines right
                headDot(hx-1, 8, skin); headDot(hx-1, 9, skin); // Left ear
                headDot(hx+hw, 8, skin); headDot(hx+hw, 9, skin); // Right ear
                
                // Eyes
                if (isTransformed) {
                    headDot(12, 9, WHITE); headDot(13, 9, eyeColor); 
                    headDot(18, 9, eyeColor); headDot(19, 9, WHITE); 
                } else {
                    headDot(13, 9, WHITE); headDot(14, 9, eyeColor); 
                    headDot(17, 9, eyeColor); headDot(18, 9, WHITE); 
                }
                
                // Mouth
                headDot(15, 11, 0xaa6655);

                // Cape and Turban (Base form only)
                if(!isTransformed) { 
                    // Turban
                    headBox(11, 3, 10, 5, WHITE_CAPE); 
                    // Turban folds
                    headBox(11, 5, 10, 1, CAPE_SHADOW); 
                    headBox(12, 4, 8, 1, CAPE_SHADOW); 
                    headBox(13, 6, 6, 1, CAPE_SHADOW); 
                    headBox(13, 2, 6, 2, GI_PURPLE); 
                    headBox(14, 2, 4, 1, GI_SHADOW); // Turban gem/knot shadow
                    
                    // Cape shoulders
                    headBox(5, 13, 7, 4, WHITE_CAPE); headDot(5, 12, WHITE_CAPE); 
                    headBox(20, 13, 7, 4, WHITE_CAPE); headDot(26, 12, WHITE_CAPE); 
                    // Cape shoulder pads definition
                    headBox(6, 14, 5, 1, CAPE_SHADOW); headBox(7, 16, 3, 1, CAPE_SHADOW);
                    headBox(21, 14, 5, 1, CAPE_SHADOW); headBox(22, 16, 3, 1, CAPE_SHADOW);
                    
                    // Cape back
                    box(11, 13, 10, 3, WHITE_CAPE); 
                    // Cape back folds
                    box(12, 14, 1, 2, CAPE_SHADOW); box(15, 14, 2, 2, CAPE_SHADOW); box(19, 14, 1, 2, CAPE_SHADOW);
                }
                break;
            }
            case 'gohan': {
                const GI_PURPLE = 0x5b2c6f; // Deep violet/purple (Piccolo's Gi)
                const GI_SHADOW = 0x4a235a; 
                const SASH_RED = 0xc0392b; // Red sash
                const SASH_SHADOW = 0x922b21;
                const SHOE_BROWN = 0xa0522d; // Tan/brown shoes
                const WRISTBAND_RED = 0xc0392b; // Super Hero wristbands are red
                const WRISTBAND_SHADOW = 0x922b21;
                
                const HAIR_BASE = BLACK; 
                const HAIR_BEAST = 0xf8f9fa; // Bright silver/white
                const HAIR_SHADOW = 0xced4da;
                const EYE_BEAST = 0xff0000; // Red eyes
                
                const hairColor = isTransformed ? HAIR_BEAST : HAIR_BASE; 
                const eyeColor = isTransformed ? EYE_BEAST : BLACK;

                if (isTransformed) {
                    // Layered Violet/Magenta/Red/Blue Aura (Beast aura is wild)
                    const AURA_VIOLET = 0x8a2be2;
                    const AURA_MAGENTA = 0xff00ff;
                    const AURA_RED = 0xff3333;
                    const AURA_LIGHT = 0xddaaff;
                    
                    const drawAura = (x: number, y: number, w: number, h: number) => {
                        canvas.fillRect((offsetX + x) * SCALE, (breatheOffset + y + DRAW_OFFSET_Y) * SCALE, w * SCALE, h * SCALE);
                    };

                    // Outer violet aura (jagged)
                    canvas.fillStyle(AURA_VIOLET, 0.3);
                    drawAura(0, -30, 32, 62);
                    drawAura(2, -36, 28, 68);
                    drawAura(6, -42, 20, 74);
                    
                    // Inner magenta aura
                    canvas.fillStyle(AURA_MAGENTA, 0.5);
                    drawAura(3, -20, 26, 52);
                    drawAura(5, -26, 22, 58);
                    drawAura(8, -32, 16, 64);
                    
                    // Reddish inner core
                    canvas.fillStyle(AURA_RED, 0.4);
                    drawAura(6, -10, 20, 42);
                    drawAura(10, -18, 12, 50);

                    // Core light aura
                    canvas.fillStyle(AURA_LIGHT, 0.6);
                    drawAura(8, -4, 16, 36);
                    drawAura(12, -12, 8, 44);
                    
                    // Aura lightning / energy sparks (Blue/Purple lightning)
                    canvas.fillStyle(0x00ffff, 0.8);
                    if (f % 3 === 0) {
                        drawAura(4, 10, 2, 12); drawAura(6, 16, 6, 2); drawAura(10, 18, 2, 8);
                        drawAura(26, -10, 2, 10); drawAura(22, 0, 6, 2);
                    } else if (f % 3 === 1) {
                        drawAura(28, 15, 2, 10); drawAura(22, 21, 8, 2); drawAura(20, 23, 2, 8);
                        drawAura(4, -15, 2, 12); drawAura(6, -5, 6, 2);
                    } else {
                        drawAura(2, -5, 2, 10); drawAura(4, 2, 6, 2);
                        drawAura(26, 25, 2, 12); drawAura(20, 31, 8, 2);
                    }
                    
                    // Subtle purple/white aura particles
                    canvas.fillStyle(0xffffff, 0.9);
                    if (f % 4 === 0) {
                        drawAura(-5, 5, 3, 3); drawAura(35, -15, 3, 3); drawAura(15, -50, 3, 3);
                    } else if (f % 4 === 2) {
                        drawAura(-8, -25, 3, 3); drawAura(40, 15, 3, 3); drawAura(10, -45, 3, 3);
                    }
                    canvas.fillStyle(0xddaaff, 0.9);
                    if (f % 5 === 0) {
                        drawAura(8, -10, 3, 3); drawAura(30, -30, 3, 3); drawAura(25, -55, 3, 3);
                    } else if (f % 5 === 2) {
                        drawAura(-10, -15, 3, 3); drawAura(35, 5, 3, 3); drawAura(12, -52, 3, 3);
                    }
                }

                // --- BODY ---
                // Legs
                box(10, 23, 4, 6, GI_PURPLE); box(18, 23, 4, 6, GI_PURPLE);
                // Gi folds on legs
                box(10, 23, 1, 6, GI_SHADOW); box(21, 23, 1, 6, GI_SHADOW);
                box(12, 24, 1, 4, GI_SHADOW); box(19, 24, 1, 4, GI_SHADOW);
                // Shoes (Brown)
                box(10, 29, 4, 3, SHOE_BROWN); box(18, 29, 4, 3, SHOE_BROWN);
                box(10, 29, 4, 1, 0xcd853f); box(18, 29, 4, 1, 0xcd853f); // Shoe highlight
                box(10, 31, 4, 1, 0x5c4033); box(18, 31, 4, 1, 0x5c4033); // Sole
                // Shoe shadows
                box(10, 30, 1, 2, 0x8b4513); box(18, 30, 1, 2, 0x8b4513);

                // Torso
                box(11, 14, 10, 9, GI_PURPLE);
                box(14, 14, 4, 2, SKIN); // Neck/Chest opening
                // Neck shadow
                box(14, 15, 4, 1, 0xe0ac7d);
                dot(15, 16, SKIN); // V-neck dip
                // Gi folds on torso
                box(19, 17, 2, 6, GI_SHADOW); // Shading right
                box(11, 17, 1, 5, GI_SHADOW); // Shading left
                box(14, 18, 1, 4, GI_SHADOW); box(17, 18, 1, 4, GI_SHADOW); // Inner folds
                box(12, 19, 8, 1, GI_SHADOW); // Horizontal fold

                // Sash with knot (Red)
                box(11, 22, 10, 2, SASH_RED);
                // Sash shadow
                box(11, 23, 10, 1, SASH_SHADOW);
                const knotY = (f % 2 === 0) ? 23 : 24; 
                box(11, 23, 2, 4, SASH_RED); dot(12, 27, SASH_RED);
                box(11, 24, 1, 3, SASH_SHADOW); // Knot shadow

                // Arms (Wristbands)
                box(8, 14, 3, 4, GI_PURPLE); box(21, 14, 3, 4, GI_PURPLE);
                // Shoulder gi folds
                box(8, 15, 1, 3, GI_SHADOW); box(23, 15, 1, 3, GI_SHADOW);
                
                box(8, 18, 3, 3, SKIN); box(21, 18, 3, 3, SKIN);
                // Arm muscle shading
                box(8, 18, 1, 3, 0xe0ac7d); box(23, 18, 1, 3, 0xe0ac7d);
                box(9, 19, 1, 2, 0xe0ac7d); box(22, 19, 1, 2, 0xe0ac7d); // Bicep definition
                
                box(8, 20, 3, 3, WRISTBAND_RED); box(21, 20, 3, 3, WRISTBAND_RED); // Wristband
                // Wristband shadow
                box(8, 20, 1, 3, WRISTBAND_SHADOW); box(23, 20, 1, 3, WRISTBAND_SHADOW);
                
                box(8, 23, 3, 2, SKIN); box(21, 23, 3, 2, SKIN); // Hands
                // Knuckles
                box(8, 24, 3, 1, 0xe0ac7d); box(21, 24, 3, 1, 0xe0ac7d);

                // Head
                headBox(12, 6, 8, 7, SKIN);
                headDot(11, 9, SKIN); headDot(20, 9, SKIN); // Ears
                headDot(11, 10, 0xe0ac7d); headDot(20, 10, 0xe0ac7d); // Ear shadows
                headBox(13, 12, 6, 1, 0xe0ac7d); // Jaw shadow
                
                // Face
                headDot(13, 9, WHITE); headDot(18, 9, WHITE); 
                headDot(14, 9, eyeColor); headDot(17, 9, eyeColor);
                headDot(13, 8, hairColor); headDot(14, 8, hairColor);
                headDot(17, 8, hairColor); headDot(18, 8, hairColor);
                // Angry brow furrow
                headDot(15, 8, 0xe0ac7d); headDot(16, 8, 0xe0ac7d);
                headDot(15, 11, 0xcc8866); // Nose
                // Cheek lines (iconic DBZ style)
                headDot(13, 11, 0xe0ac7d); headDot(18, 11, 0xe0ac7d);

                if (isTransformed) { 
                    // Beast Hair (Spiky, tall, but within bounds)
                    headBox(11, 0, 10, 6, hairColor); // Base
                    headBox(10, -2, 2, 6, hairColor); // Left side
                    headBox(20, -2, 2, 6, hairColor); // Right side
                    headBox(12, -4, 2, 6, hairColor); // Top spike left
                    headBox(15, -6, 3, 8, hairColor); // Top spike middle (tallest)
                    headBox(18, -3, 2, 5, hairColor); // Top spike right
                    headBox(8, 2, 2, 4, hairColor); // Far left spike
                    headBox(22, 2, 2, 4, hairColor); // Far right spike
                    
                    // The iconic Beast bang
                    headBox(14, 6, 2, 4, hairColor);
                    headBox(15, 10, 1, 3, hairColor);
                    
                    // Hair shading
                    headBox(11, -2, 1, 6, HAIR_SHADOW); headBox(20, -2, 1, 6, HAIR_SHADOW);
                    headBox(12, -4, 1, 6, HAIR_SHADOW); headBox(18, -3, 1, 5, HAIR_SHADOW);
                    headBox(15, -6, 1, 8, HAIR_SHADOW); // Middle spike shadow
                    headBox(14, 6, 1, 4, HAIR_SHADOW); // Bang shadow
                } else { 
                    // Ultimate Gohan hair (spiky but normal length, one bang)
                    headBox(11, 1, 10, 5, hairColor); 
                    headBox(10, -1, 2, 4, hairColor); // Left side
                    headBox(20, -1, 2, 4, hairColor); // Right side
                    headBox(12, -3, 2, 4, hairColor); // Top spike left
                    headBox(15, -4, 2, 5, hairColor); // Top spike middle
                    headBox(18, -2, 2, 3, hairColor); // Top spike right
                    
                    // Bang
                    headBox(14, 6, 2, 3, hairColor);
                    headBox(15, 9, 1, 2, hairColor);
                    
                    // Hair shading
                    const hairShadow = 0x333333;
                    headBox(11, -1, 1, 4, hairShadow); headBox(20, -1, 1, 4, hairShadow);
                    headBox(12, -3, 1, 4, hairShadow); headBox(18, -2, 1, 3, hairShadow);
                    headBox(15, -4, 1, 5, hairShadow); // Middle spike shadow
                    headBox(14, 6, 1, 3, hairShadow); // Bang shadow
                }
                break;
            }
            case 'frieza': {
                // --- PALETTES ---
                // Final Form (Base)
                const F_WHITE = 0xf8f9fa;
                const F_WHITE_SHADE = 0xcbd5e1;
                const F_PURPLE = 0x7e22ce;
                const F_PURPLE_SHADE = 0x4c1d95;
                const F_PURPLE_LIGHT = 0xc084fc;
                
                // Golden Form
                const G_GOLD = 0xffd700;
                const G_GOLD_SHADE = 0xb45309;
                const G_GOLD_LIGHT = 0xfff599;
                const G_PURPLE = 0x4c1d95; // Face, hands, feet, abdomen
                const G_PURPLE_SHADE = 0x2e1065;
                const G_PURPLE_LIGHT = 0x6d28d9;
                
                // --- ASSIGNMENTS ---
                const mainColor = isTransformed ? G_GOLD : F_WHITE;
                const mainShade = isTransformed ? G_GOLD_SHADE : F_WHITE_SHADE;
                const mainLight = isTransformed ? G_GOLD_LIGHT : F_WHITE;
                
                const accentColor = isTransformed ? G_GOLD : F_PURPLE;
                const accentShade = isTransformed ? G_GOLD_SHADE : F_PURPLE_SHADE;
                const accentLight = isTransformed ? G_GOLD_LIGHT : F_PURPLE_LIGHT;
                
                const faceColor = isTransformed ? G_PURPLE : F_WHITE;
                const faceShade = isTransformed ? G_PURPLE_SHADE : F_WHITE_SHADE;
                
                const abdomenColor = isTransformed ? G_PURPLE : F_WHITE;
                const abdomenShade = isTransformed ? G_PURPLE_SHADE : F_WHITE_SHADE;
                
                const domeColor = isTransformed ? G_PURPLE : F_PURPLE;
                const domeLight = isTransformed ? G_PURPLE_LIGHT : F_PURPLE_LIGHT;
                
                const gemColor = isTransformed ? G_GOLD : F_PURPLE;
                const gemLight = isTransformed ? G_GOLD_LIGHT : F_PURPLE_LIGHT;
                
                // --- DRAWING ---
                
                // 1. TAIL (Background)
                const ty = (f % 2 === 0) ? 22 : 23; // slight animation
                box(15, ty, 8, 3, mainColor); // Base
                box(15, ty+2, 8, 1, mainShade); // Base shade
                box(20, ty-4, 3, 6, mainColor); // Curve up
                box(20, ty-4, 1, 6, mainShade); // Curve shade
                box(21, ty-8, 2, 5, mainColor); // Tip up
                box(20, ty-10, 2, 3, mainColor); // Tip point
                
                // 2. LEGS
                // Thighs
                box(12, 21, 3, 5, mainColor); box(17, 21, 3, 5, mainColor);
                box(12, 21, 1, 5, mainShade); box(19, 21, 1, 5, mainShade); // Outer shade
                // Shins (Accent color)
                box(12, 26, 3, 4, accentColor); box(17, 26, 3, 4, accentColor);
                box(12, 26, 1, 4, accentShade); box(19, 26, 1, 4, accentShade);
                // Feet (3 Toes)
                box(11, 30, 4, 2, faceColor); box(17, 30, 4, 2, faceColor);
                // Toes
                box(10, 31, 2, 1, faceColor); box(12, 31, 2, 1, faceColor); box(14, 31, 2, 1, faceColor);
                box(16, 31, 2, 1, faceColor); box(18, 31, 2, 1, faceColor); box(20, 31, 2, 1, faceColor);
                
                // 3. TORSO
                // Abdomen (Ribbed)
                box(13, 17, 6, 4, abdomenColor);
                box(13, 17, 6, 1, abdomenShade); box(13, 19, 6, 1, abdomenShade); // Ribs
                // Chest
                box(11, 12, 10, 5, mainColor);
                box(11, 12, 1, 5, mainShade); box(20, 12, 1, 5, mainShade); // Chest shade
                // Chest Gem
                box(13, 13, 4, 3, gemColor);
                box(14, 13, 2, 1, gemLight); // Gem shine
                dot(14, 13, 0xffffff); // Specular
                
                // 4. ARMS
                // Shoulders (Spherical pads)
                box(7, 11, 4, 4, mainColor); box(21, 11, 4, 4, mainColor);
                box(8, 12, 2, 2, accentColor); box(22, 12, 2, 2, accentColor); // Inner pad
                dot(8, 12, accentLight); dot(22, 12, accentLight); // Pad shine
                // Upper Arm
                box(8, 15, 2, 4, mainColor); box(22, 15, 2, 4, mainColor);
                // Forearm (Accent color)
                box(8, 19, 2, 3, accentColor); box(22, 19, 2, 3, accentColor);
                // Hands
                box(8, 22, 2, 2, faceColor); box(22, 22, 2, 2, faceColor);
                
                // 5. HEAD
                // Neck
                headBox(13, 10, 6, 2, mainColor);
                // Face Base
                headBox(12, 4, 8, 6, faceColor);
                headBox(12, 4, 1, 6, faceShade); headBox(19, 4, 1, 6, faceShade); // Side shade
                headBox(13, 9, 6, 1, faceShade); // Jaw shade
                
                // Dome
                headBox(12, 0, 8, 4, domeColor);
                headBox(13, 0, 6, 2, domeLight); // Dome shine
                headBox(14, 0, 2, 1, 0xffffff); // Specular
                
                // Eyes (Menacing)
                headBox(13, 6, 2, 1, 0xffffff); headBox(17, 6, 2, 1, 0xffffff); // Sclera
                headDot(14, 6, 0xff0000); headDot(17, 6, 0xff0000); // Red pupil
                // Eyeliner (Black)
                headBox(13, 5, 2, 1, 0x000000); headBox(17, 5, 2, 1, 0x000000);
                // Cheek lines (Iconic Frieza lines)
                headDot(12, 7, 0x000000); headDot(19, 7, 0x000000);
                headDot(13, 8, 0x000000); headDot(18, 8, 0x000000);
                
                // Mouth
                headBox(15, 8, 2, 1, 0x000000); // Smirk
                
                break;
            }
            case 'cell': {
                const GREEN = 0x66bb66; 
                const DARK_GREEN = 0x448844;
                const BLACK_S = 0x112211; 
                const PALE = 0xeeeeee; 
                const ORANGE = 0xffaa00;
                const PURPLE = 0xaa44cc;
                const PINK_EYE = 0xff00cc;
                
                // Wings (Beetle-like, drawn first so they are behind)
                const wingSpread = (f % 2 === 0) ? 0 : 1;
                // Left wing
                box(6 - wingSpread, 12, 6, 15, BLACK_S);
                box(7 - wingSpread, 13, 4, 13, 0x223322); // Wing highlight/texture
                box(6 - wingSpread, 12, 1, 15, 0x0a140a); // Wing shadow
                // Right wing
                box(20 + wingSpread, 12, 6, 15, BLACK_S);
                box(21 + wingSpread, 13, 4, 13, 0x223322); // Wing highlight/texture
                box(25 + wingSpread, 12, 1, 15, 0x0a140a); // Wing shadow
                
                // Legs (Thighs and Calves)
                box(10, 23, 4, 6, GREEN); box(18, 23, 4, 6, GREEN);
                box(10, 23, 1, 6, DARK_GREEN); box(21, 23, 1, 6, DARK_GREEN); // Leg shadow
                box(11, 23, 1, 6, 0x88dd88); box(19, 23, 1, 6, 0x88dd88); // Leg highlight
                // Black spots on legs
                dot(11, 24, BLACK_S); dot(13, 26, BLACK_S); dot(10, 27, BLACK_S);
                dot(19, 25, BLACK_S); dot(21, 24, BLACK_S); dot(18, 27, BLACK_S);
                
                // Boots
                box(10, 29, 4, 3, BLACK_S); box(18, 29, 4, 3, BLACK_S); 
                box(10, 31, 4, 2, ORANGE); box(18, 31, 4, 2, ORANGE);
                box(10, 32, 4, 1, 0xcc8800); box(18, 32, 4, 1, 0xcc8800); // Boot shadow
                
                // Torso (Chest and Abdomen)
                // Black upper chest/neck area
                box(11, 14, 10, 4, BLACK_S); 
                box(12, 14, 8, 3, 0x223322); // Chest highlight
                // Green abdomen
                box(12, 18, 8, 4, GREEN); 
                box(12, 18, 1, 4, DARK_GREEN); box(19, 18, 1, 4, DARK_GREEN); // Abdomen shadow
                // Ribbed texture on abdomen
                box(12, 19, 8, 1, DARK_GREEN); box(12, 21, 8, 1, DARK_GREEN); 
                // Black pelvis area
                box(11, 22, 10, 2, BLACK_S);
                box(12, 22, 8, 1, 0x223322); // Pelvis highlight
                
                // Arms
                // Shoulders
                box(7, 14, 4, 3, GREEN); box(21, 14, 4, 3, GREEN); 
                box(7, 14, 1, 3, DARK_GREEN); box(24, 14, 1, 3, DARK_GREEN); // Shoulder shadow
                box(8, 14, 1, 3, 0x88dd88); box(22, 14, 1, 3, 0x88dd88); // Shoulder highlight
                // Spots on shoulders
                dot(8, 15, BLACK_S); dot(22, 15, BLACK_S);
                
                // Upper arms
                box(8, 17, 3, 5, GREEN); box(21, 17, 3, 5, GREEN); 
                box(8, 17, 1, 5, DARK_GREEN); box(23, 17, 1, 5, DARK_GREEN); // Arm shadow
                // Spots on arms
                dot(9, 18, BLACK_S); dot(8, 20, BLACK_S);
                dot(22, 19, BLACK_S); dot(23, 17, BLACK_S);
                
                // Lower arms/Hands
                box(8, 21, 3, 2, BLACK_S); box(21, 21, 3, 2, BLACK_S); 
                box(8, 23, 3, 2, PALE); box(21, 23, 3, 2, PALE);
                box(8, 24, 3, 1, 0xcccccc); box(21, 24, 3, 1, 0xcccccc); // Hand shadow
                
                // Head
                // Base face
                headBox(12, 6, 8, 7, GREEN); 
                headBox(12, 6, 1, 7, DARK_GREEN); headBox(19, 6, 1, 7, DARK_GREEN); // Face side shadow
                
                // Crown (Refined shape)
                headBox(11, 0, 2, 8, GREEN); // Left tall prong
                headBox(19, 0, 2, 8, GREEN); // Right tall prong
                headBox(11, 0, 1, 8, DARK_GREEN); headBox(20, 0, 1, 8, DARK_GREEN); // Prong shadow
                headBox(13, 2, 6, 4, GREEN); // Center crown base
                headBox(14, 1, 4, 2, GREEN); // Center crown peak
                headBox(13, 2, 6, 1, 0x88dd88); // Crown highlight
                
                // Crown spots
                headDot(11, 2, BLACK_S); headDot(12, 5, BLACK_S);
                headDot(20, 3, BLACK_S); headDot(19, 6, BLACK_S);
                headDot(15, 3, BLACK_S); headDot(16, 4, BLACK_S);
                
                // Pale face plate
                headBox(13, 8, 6, 5, PALE); 
                headBox(13, 12, 6, 1, 0xcccccc); // Jaw shadow
                
                // Purple cheek lines
                headBox(12, 9, 1, 3, PURPLE); headBox(19, 9, 1, 3, PURPLE); 
                
                // Eyes
                headBox(13, 9, 2, 1, WHITE); headBox(17, 9, 2, 1, WHITE);
                headDot(14, 9, PINK_EYE); headDot(17, 9, PINK_EYE);
                
                // Eyeliner / Brow ridge
                headBox(13, 8, 2, 1, BLACK_S); headBox(17, 8, 2, 1, BLACK_S);
                
                // Mouth
                headBox(15, 12, 2, 1, BLACK_S);
                
                break;
            }
            case 'minipekka': {
                const METAL_LIGHT = isTransformed ? 0x333333 : 0xd5dbdb; 
                const METAL_DARK = isTransformed ? 0x111111 : 0x7f8c8d; 
                const METAL_JOINT = isTransformed ? 0x1a1a1a : 0x2c3e50; 
                const ACCENT = isTransformed ? 0x9b59b6 : 0x3498db; // Blue vs Purple
                const EYE = isTransformed ? 0xff33cc : 0x00ffff; // Cyan vs Pinkish-Purple
                
                // Legs
                box(10, 29, 5, 3, METAL_DARK); box(17, 29, 5, 3, METAL_DARK); // Feet
                box(10, 27, 5, 2, METAL_LIGHT); box(17, 27, 5, 2, METAL_LIGHT); // Lower leg
                box(11, 25, 3, 2, METAL_JOINT); box(18, 25, 3, 2, METAL_JOINT); // Joint
                // Leg shading
                box(10, 29, 1, 3, 0x111111); box(17, 29, 1, 3, 0x111111);
                box(10, 27, 1, 2, METAL_DARK); box(17, 27, 1, 2, METAL_DARK);
                
                const offY = 6; 
                // Torso
                box(11, 19+offY, 10, 3, METAL_JOINT); // Waist
                box(9, 13+offY, 14, 7, METAL_LIGHT); // Chest
                box(9, 18+offY, 14, 2, METAL_DARK); // Lower chest
                box(13, 14+offY, 6, 5, METAL_DARK); // Chest plate
                box(14, 15+offY, 4, 3, ACCENT); // Chest core
                // Torso shading
                box(9, 13+offY, 1, 7, METAL_DARK); box(22, 13+offY, 1, 7, METAL_DARK);
                box(13, 14+offY, 1, 5, 0x111111); box(18, 14+offY, 1, 5, 0x111111);
                
                // Arms
                box(7, 15+offY, 2, 6, METAL_LIGHT); box(23, 15+offY, 2, 6, METAL_LIGHT); // Upper arm
                box(7, 21+offY, 2, 2, METAL_DARK); box(23, 21+offY, 2, 2, METAL_DARK); // Hand
                // Arm shading
                box(7, 15+offY, 1, 6, METAL_DARK); box(24, 15+offY, 1, 6, METAL_DARK);
                
                // Sword
                const swordY = (f % 2 === 0) ? 14+offY : 15+offY; 
                headBox(6, swordY+6, 2, 4, 0x555555); // Hilt
                headBox(5, swordY+5, 4, 1, METAL_DARK); // Guard
                headBox(5, swordY-2, 4, 7, 0xecf0f1); // Blade
                headBox(6, swordY-3, 2, 1, 0xecf0f1); // Tip
                // Sword shading
                headBox(7, swordY-2, 2, 7, 0xbdc3c7);
                headBox(7, swordY-3, 1, 1, 0xbdc3c7);
                
                // Head
                headBox(11, 10+offY, 10, 3, METAL_LIGHT); // Lower head
                headBox(11, 6+offY, 10, 4, METAL_LIGHT); // Upper head
                headBox(11, 9+offY, 10, 2, 0x000000); // Visor slit
                headBox(14, 9+offY, 4, 2, EYE); // Eye
                headBox(9, 5+offY, 2, 4, ACCENT); headBox(21, 5+offY, 2, 4, ACCENT); // Horns
                headDot(9, 4+offY, ACCENT); headDot(21, 4+offY, ACCENT); // Horn tips
                // Head shading
                headBox(11, 6+offY, 1, 7, METAL_DARK); headBox(20, 6+offY, 1, 7, METAL_DARK);
                headBox(9, 5+offY, 1, 4, 0x111111); headBox(22, 5+offY, 1, 4, 0x111111);
                break;
            }
            case 'cyberninja': {
                const SUIT_MAIN = isTransformed ? 0x222222 : 0x2d3436; // Darker when transformed
                const SUIT_DARK = 0x111111;
                const SCARF = isTransformed ? 0xff0055 : 0x00d2d3; // Red vs Cyan
                const VISOR = isTransformed ? 0xff0000 : 0x00eaff;
                const SKIN_PALE = 0xffeebb;
                
                // Legs (Baggy ninja pants)
                box(10, 24, 4, 6, SUIT_MAIN); box(18, 24, 4, 6, SUIT_MAIN);
                box(10, 24, 1, 6, SUIT_DARK); box(21, 24, 1, 6, SUIT_DARK); // Leg shadow
                box(10, 30, 4, 2, SUIT_DARK); box(18, 30, 4, 2, SUIT_DARK); // Boots
                box(10, 31, 4, 1, 0x000000); box(18, 31, 4, 1, 0x000000); // Boot shadow
                
                // Torso (Armor vest)
                box(11, 14, 10, 10, SUIT_MAIN);
                box(11, 14, 1, 10, SUIT_DARK); box(20, 14, 1, 10, SUIT_DARK); // Torso shadow
                box(12, 15, 8, 5, SUIT_DARK); // Chest plate
                box(12, 15, 8, 1, 0x333333); // Chest highlight
                
                // Arms
                box(8, 14, 3, 5, SUIT_MAIN); box(21, 14, 3, 5, SUIT_MAIN);
                box(8, 14, 1, 5, SUIT_DARK); box(23, 14, 1, 5, SUIT_DARK); // Arm shadow
                box(8, 19, 3, 4, SKIN_PALE); box(21, 19, 3, 4, SKIN_PALE); // Bare arms/gloves
                box(8, 19, 1, 4, 0xccbb99); box(23, 19, 1, 4, 0xccbb99); // Skin shadow
                box(8, 21, 3, 2, SUIT_DARK); box(21, 21, 3, 2, SUIT_DARK); // Gloves
                box(8, 22, 3, 1, 0x000000); box(21, 22, 3, 1, 0x000000); // Glove shadow
                
                // Head
                headBox(12, 6, 8, 8, SUIT_MAIN); // Hood
                headBox(12, 6, 1, 8, SUIT_DARK); headBox(19, 6, 1, 8, SUIT_DARK); // Hood shadow
                headBox(13, 8, 6, 3, SKIN_PALE); // Face opening
                headBox(13, 10, 6, 1, 0xccbb99); // Face shadow
                headBox(13, 8, 6, 1, VISOR); // Visor eye
                headBox(13, 8, 2, 1, 0xffffff); // Visor highlight
                
                // Scarf Animation (Flowing in wind)
                // Base position neck
                headBox(11, 13, 10, 2, SCARF); 
                headBox(11, 14, 10, 1, 0x880022); // Scarf shadow
                
                // Tail of scarf
                let scarfLen = 0;
                let scarfY = 0;
                
                if (f === 0) { scarfLen = 8; scarfY = 13; }
                else if (f === 1) { scarfLen = 10; scarfY = 12; }
                else if (f === 2) { scarfLen = 12; scarfY = 14; }
                else if (f === 3) { scarfLen = 10; scarfY = 13; }
                
                // Draw scarf tail to the left (wind blowing right to left conceptually, or just flow)
                // Let's draw it flowing behind (left side of sprite)
                // Ensure it doesn't go below x=0 to avoid bleeding into previous frame
                const scarfStartX = Math.max(0, 11 - scarfLen);
                const actualScarfLen = 11 - scarfStartX;
                if (actualScarfLen > 0) {
                    headBox(scarfStartX, scarfY, actualScarfLen, 3, SCARF);
                }
                
                // Katana Handle on back (left side since facing right)
                headBox(9, 4, 2, 6, 0x555555);
                break;
            }
            case 'leonardo': {
                const GREEN = 0x2ecc71;
                const GREEN_SHADOW = 0x27ae60;
                const SHELL_FRONT = 0xf1c40f;
                const SHELL_BACK = 0x1e8449;
                const BANDANA = 0x3498db;
                const BELT = 0x5c4033;
                const PAD = 0x5c4033;
                const STEEL = 0xbdc3c7;
                
                // Katanas on back (drawn first to be behind)
                box(9, 12, 2, 10, STEEL); box(21, 12, 2, 10, STEEL); // Blades crossing
                box(9, 12, 1, 10, 0x7f8c8d); box(22, 12, 1, 10, 0x7f8c8d); // Blade shadow
                
                // Legs
                box(10, 24, 4, 6, GREEN); box(18, 24, 4, 6, GREEN);
                box(10, 24, 1, 6, GREEN_SHADOW); box(21, 24, 1, 6, GREEN_SHADOW); // Leg shadow
                box(10, 27, 4, 2, PAD); box(18, 27, 4, 2, PAD); // Knee pads
                box(10, 28, 4, 1, 0x3e2723); box(18, 28, 4, 1, 0x3e2723); // Pad shadow
                
                // Torso
                box(11, 14, 10, 10, GREEN);
                box(11, 14, 1, 10, GREEN_SHADOW); box(20, 14, 1, 10, GREEN_SHADOW); // Torso shadow
                box(12, 15, 8, 8, SHELL_FRONT); // Front shell
                box(14, 15, 4, 8, 0xe6b800); // Shell detail
                box(12, 15, 8, 1, 0xffeb3b); // Shell highlight
                box(11, 21, 10, 2, BELT); // Belt
                box(11, 22, 10, 1, 0x3e2723); // Belt shadow
                dot(15, 21, 0xaaaaaa); dot(16, 21, 0xaaaaaa); // Belt buckle
                
                // Arms
                box(8, 14, 3, 8, GREEN); box(21, 14, 3, 8, GREEN);
                box(8, 14, 1, 8, GREEN_SHADOW); box(23, 14, 1, 8, GREEN_SHADOW); // Arm shadow
                box(8, 18, 3, 2, PAD); box(21, 18, 3, 2, PAD); // Elbow pads
                box(8, 19, 3, 1, 0x3e2723); box(21, 19, 3, 1, 0x3e2723); // Pad shadow
                box(8, 21, 3, 2, PAD); box(21, 21, 3, 2, PAD); // Wrist wraps
                box(8, 22, 3, 1, 0x3e2723); box(21, 22, 3, 1, 0x3e2723); // Wrap shadow
                
                // Head
                headBox(12, 6, 8, 8, GREEN);
                headBox(12, 6, 1, 8, GREEN_SHADOW); headBox(19, 6, 1, 8, GREEN_SHADOW); // Head shadow
                headBox(11, 9, 10, 2, BANDANA); // Bandana
                headBox(11, 10, 10, 1, 0x2980b9); // Bandana shadow
                headBox(10, 10, 2, 4, BANDANA); // Bandana knot tail
                headBox(10, 10, 1, 4, 0x2980b9); // Knot tail shadow
                headDot(13, 9, WHITE); headDot(17, 9, WHITE); // Eyes
                break;
            }
            case 'frieren': {
                const HAIR = 0xecf0f1;
                const HAIR_SHADOW = 0xbdc3c7;
                const COAT = 0xffffff;
                const COAT_SHADOW = 0xe0e0e0;
                const SCARF = 0x2c3e50; // Dark blue/black collar
                const GOLD = 0xf1c40f;
                const SKIN = 0xffeebb;
                const TIGHTS = 0x111111;
                const BOOTS = 0x8b4513;
                
                // Staff (drawn first to be behind)
                box(23, 10, 2, 20, 0x8b4513); // Staff pole
                box(22, 8, 4, 3, GOLD); // Staff top
                dot(23, 7, 0xe74c3c); // Red gem
                box(24, 10, 1, 20, 0x5d4037); // Staff shadow
                
                // Legs
                box(12, 24, 3, 6, TIGHTS); box(17, 24, 3, 6, TIGHTS);
                box(12, 24, 1, 6, 0x000000); box(17, 24, 1, 6, 0x000000); // Tights shadow
                box(11, 28, 4, 3, BOOTS); box(17, 28, 4, 3, BOOTS);
                box(11, 28, 1, 3, 0x5d4037); box(17, 28, 1, 3, 0x5d4037); // Boots shadow
                
                // Torso
                box(11, 14, 10, 10, COAT);
                box(11, 14, 1, 10, COAT_SHADOW); box(20, 14, 1, 10, COAT_SHADOW); // Coat shadow
                box(11, 14, 10, 3, SCARF); // Collar
                box(11, 16, 10, 1, 0x1a252f); // Collar shadow
                box(15, 14, 2, 10, GOLD); // Center trim
                box(11, 22, 10, 2, 0x222222); // Belt
                box(11, 23, 10, 1, 0x000000); // Belt shadow
                
                // Arms
                box(8, 14, 3, 8, COAT); box(21, 14, 3, 8, COAT);
                box(8, 14, 1, 8, COAT_SHADOW); box(23, 14, 1, 8, COAT_SHADOW); // Arm shadow
                box(8, 20, 3, 2, TIGHTS); box(21, 20, 3, 2, TIGHTS); // Gloves/cuffs
                box(8, 21, 3, 1, 0x000000); box(21, 21, 3, 1, 0x000000); // Cuff shadow
                
                // Head
                headBox(12, 6, 8, 8, SKIN);
                headBox(12, 6, 1, 8, 0xccbb99); headBox(19, 6, 1, 8, 0xccbb99); // Face shadow
                
                // Elf Ears
                headBox(8, 9, 4, 2, SKIN); headBox(20, 9, 4, 2, SKIN);
                headBox(8, 10, 4, 1, 0xccbb99); headBox(20, 10, 4, 1, 0xccbb99); // Ear shadow
                
                // Hair
                headBox(11, 4, 10, 4, HAIR); // Hair top
                headBox(13, 4, 6, 1, HAIR_SHADOW);
                // Twintails
                headBox(9, 6, 3, 12, HAIR); headBox(20, 6, 3, 12, HAIR); 
                headBox(9, 6, 1, 12, HAIR_SHADOW); headBox(22, 6, 1, 12, HAIR_SHADOW); // Twintail shadow
                headBox(10, 18, 2, 2, 0xcc0000); headBox(20, 18, 2, 2, 0xcc0000); // Red hair ties
                
                // Face
                headDot(14, 9, 0x27ae60); headDot(17, 9, 0x27ae60); // Eyes
                headDot(13, 8, HAIR_SHADOW); headDot(18, 8, HAIR_SHADOW); // Eyebrows
                break;
            }
            case 'optimus': {
                const RED = 0xe74c3c;
                const RED_SHADOW = 0xc0392b;
                const BLUE = 0x2980b9;
                const BLUE_SHADOW = 0x1f618d;
                const SILVER = 0xbdc3c7;
                const DARK_METAL = 0x7f8c8d;
                const YELLOW = 0xf1c40f;
                const WINDOW = 0x87ceeb;
                const TIRE = 0x111111;
                
                if (isTransformed) {
                    // TRUCK MODE REMASTER
                    // Tires (more rounded)
                    box(6, 24, 4, 8, TIRE); box(22, 24, 4, 8, TIRE); // Front
                    box(6, 16, 4, 8, TIRE); box(22, 16, 4, 8, TIRE); // Back
                    box(7, 25, 2, 6, DARK_METAL); box(23, 25, 2, 6, DARK_METAL); // Hubcaps
                    box(7, 17, 2, 6, DARK_METAL); box(23, 17, 2, 6, DARK_METAL); // Hubcaps
                    
                    // Trailer connection / back legs area (Blue)
                    box(10, 18, 12, 10, BLUE);
                    box(11, 19, 10, 8, BLUE_SHADOW);
                    
                    // Main Cab (Red)
                    box(8, 8, 16, 14, RED);
                    box(9, 9, 14, 12, RED_SHADOW);
                    box(10, 10, 12, 10, RED);
                    
                    // Windshield (split and angled)
                    box(9, 10, 6, 5, WINDOW); box(17, 10, 6, 5, WINDOW);
                    box(10, 11, 4, 3, 0xffffff); box(18, 11, 4, 3, 0xffffff); // Glint
                    
                    // Grill (detailed)
                    box(13, 15, 6, 10, SILVER);
                    box(14, 16, 1, 8, DARK_METAL); box(17, 16, 1, 8, DARK_METAL);
                    
                    // Bumper
                    box(7, 25, 18, 4, SILVER);
                    box(8, 26, 16, 2, DARK_METAL);
                    
                    // Headlights
                    box(8, 25, 3, 3, YELLOW); box(21, 25, 3, 3, YELLOW);
                    dot(9, 26, 0xffffff); dot(22, 26, 0xffffff);
                    
                    // Smokestacks
                    box(5, 2, 2, 12, SILVER); box(25, 2, 2, 12, SILVER);
                    box(6, 2, 1, 12, 0xffffff); box(26, 2, 1, 12, 0xffffff); // Highlight
                    
                    // Top lights
                    box(10, 7, 12, 2, SILVER);
                    dot(11, 7, YELLOW); dot(15, 7, YELLOW); dot(16, 7, YELLOW); dot(20, 7, YELLOW);
                } else {
                    // ROBOT MODE REMASTER
                    // Legs (Blue with silver thighs)
                    box(10, 24, 5, 8, BLUE); box(17, 24, 5, 8, BLUE);
                    box(10, 24, 1, 8, BLUE_SHADOW); box(21, 24, 1, 8, BLUE_SHADOW); // Leg shading
                    box(11, 22, 3, 3, SILVER); box(18, 22, 3, 3, SILVER); // Thighs
                    box(11, 22, 1, 3, DARK_METAL); box(18, 22, 1, 3, DARK_METAL); // Thigh shading
                    box(10, 30, 5, 2, BLUE_SHADOW); box(17, 30, 5, 2, BLUE_SHADOW); // Feet
                    box(10, 31, 5, 1, 0x111111); box(17, 31, 5, 1, 0x111111); // Foot shadow
                    
                    // Torso (Red cab)
                    box(9, 12, 14, 10, RED);
                    box(9, 12, 1, 10, RED_SHADOW); box(22, 12, 1, 10, RED_SHADOW); // Torso shadow
                    box(10, 13, 12, 8, RED_SHADOW);
                    box(11, 14, 10, 6, RED);
                    
                    // Windshield Windows (Chest)
                    box(10, 13, 5, 5, WINDOW); box(17, 13, 5, 5, WINDOW);
                    box(11, 14, 3, 2, 0xffffff); box(18, 14, 3, 2, 0xffffff); // Glint
                    
                    // Center grill (Abdomen)
                    box(13, 18, 6, 4, SILVER); 
                    box(14, 18, 1, 4, DARK_METAL); box(17, 18, 1, 4, DARK_METAL);
                    
                    // Waist/Bumper
                    box(10, 21, 12, 3, SILVER); 
                    box(10, 23, 12, 1, DARK_METAL); // Bumper shadow
                    box(11, 21, 2, 2, YELLOW); box(19, 21, 2, 2, YELLOW); // Headlights
                    
                    // Arms
                    box(5, 12, 4, 8, RED); box(23, 12, 4, 8, RED);
                    box(4, 11, 6, 4, RED_SHADOW); box(22, 11, 6, 4, RED_SHADOW); // Shoulders
                    box(4, 14, 6, 1, 0x880000); box(22, 14, 6, 1, 0x880000); // Shoulder shadow
                    box(5, 18, 4, 5, BLUE); box(23, 18, 4, 5, BLUE); // Forearms
                    box(5, 18, 1, 5, BLUE_SHADOW); box(26, 18, 1, 5, BLUE_SHADOW); // Forearm shading
                    box(5, 22, 4, 2, BLUE_SHADOW); box(23, 22, 4, 2, BLUE_SHADOW); // Hands
                    box(5, 23, 4, 1, 0x111111); box(23, 23, 4, 1, 0x111111); // Hand shadow
                    
                    // Smokestacks (Shoulders)
                    box(4, 5, 2, 7, SILVER); box(26, 5, 2, 7, SILVER);
                    box(5, 5, 1, 7, DARK_METAL); box(27, 5, 1, 7, DARK_METAL); // Stack shadow
                    
                    // Head
                    headBox(13, 5, 6, 7, BLUE);
                    headBox(13, 5, 1, 7, BLUE_SHADOW); headBox(18, 5, 1, 7, BLUE_SHADOW); // Head shadow
                    headBox(14, 5, 4, 2, SILVER); // Crest
                    headBox(14, 5, 4, 1, 0xffffff); // Crest highlight
                    headBox(12, 6, 1, 4, BLUE); headBox(19, 6, 1, 4, BLUE); // Antennae
                    headBox(14, 8, 4, 4, SILVER); // Faceplate
                    headBox(14, 11, 4, 1, DARK_METAL); // Faceplate shadow
                    headBox(15, 9, 2, 3, DARK_METAL); // Mouthplate detail
                    headDot(14, 7, 0x00ffff); headDot(17, 7, 0x00ffff); // Eyes
                }
                break;
            }
            case 'naruto': {
                const SKIN = 0xffccaa;
                const ORANGE = 0xff8800;
                const BLACK = 0x111111;
                const BLUE = 0x2244aa;
                const YELLOW_HAIR = 0xffdd00;
                const RED_COAT = 0xcc0000;
                
                const K_ORANGE = 0xffaa00; // Kurama mode base
                const K_YELLOW = 0xffff00; // Kurama mode glow
                const K_BLACK = 0x000000; // Markings
                
                const isSageMode = form === 1;
                const isKuramaMode = form === 2;
                
                if (isKuramaMode) {
                    // Truth-Seeking Orbs (floating behind)
                    const orbY = breatheOffset - 4 + Math.sin(f * Math.PI) * 2;
                    box(4, orbY, 4, 4, K_BLACK);
                    box(24, orbY + 4, 4, 4, K_BLACK);
                    box(6, orbY + 12, 4, 4, K_BLACK);
                    box(22, orbY + 16, 4, 4, K_BLACK);
                }

                const suitColor = isKuramaMode ? K_ORANGE : ORANGE;
                const detailColor = isKuramaMode ? K_BLACK : BLACK;
                const skinColor = isKuramaMode ? K_YELLOW : SKIN;
                const hairColor = isKuramaMode ? K_YELLOW : YELLOW_HAIR;
                const suitShadow = isKuramaMode ? 0xcc8800 : 0xcc6600;
                const SAGE_ORANGE = 0xff4400;
                
                // Scroll on back (drawn before torso so it's behind)
                if (isSageMode) {
                    box(8, 15, 16, 8, 0xdddddd); // Scroll base
                    box(7, 16, 18, 6, 0x880000); // Scroll ends
                    box(10, 15, 12, 8, 0xeeeeee); // Scroll inner
                    box(8, 23, 16, 1, 0xaaaaaa); // Scroll shadow
                }

                // Legs
                box(10, 24, 4, 6, suitColor); box(18, 24, 4, 6, suitColor);
                box(10, 24, 1, 6, suitShadow); box(21, 24, 1, 6, suitShadow); // Leg shadow
                // Shoes/Sandals
                box(10, 30, 4, 2, detailColor); box(18, 30, 4, 2, detailColor);
                box(10, 31, 4, 1, 0x000000); box(18, 31, 4, 1, 0x000000); // Shoe shadow
                if (!isKuramaMode) {
                    // Bandages on right leg
                    box(10, 26, 4, 2, 0xeeeeee);
                    box(10, 27, 4, 1, 0xcccccc); // Bandage shadow
                    // Holster on right leg
                    box(13, 25, 2, 3, BLACK);
                }
                
                // Torso
                box(11, 14, 10, 10, suitColor);
                box(11, 14, 1, 10, suitShadow); box(20, 14, 1, 10, suitShadow); // Torso shadow
                if (isKuramaMode) {
                    // Magatama markings on chest
                    box(13, 16, 2, 2, K_BLACK); box(17, 16, 2, 2, K_BLACK);
                    box(15, 18, 2, 2, K_BLACK);
                    // Center line
                    box(15, 20, 2, 4, K_BLACK);
                } else {
                    // Jacket zipper/black details
                    box(15, 14, 2, 10, BLACK);
                    box(11, 14, 10, 3, BLACK); // Shoulders
                    box(11, 16, 10, 1, 0x000000); // Shoulder shadow
                    // Orange collar
                    box(11, 13, 10, 2, ORANGE);
                    box(11, 14, 10, 1, 0xcc6600); // Collar shadow
                    // White swirl on left arm
                    box(21, 16, 2, 2, 0xeeeeee);
                    
                    if (isSageMode) {
                        // Red Coat (Open in the front)
                        // Left side
                        box(9, 14, 4, 12, RED_COAT);
                        box(9, 14, 1, 12, 0x880000); // Coat shadow
                        box(9, 24, 4, 2, BLACK); // Flames
                        // Right side
                        box(19, 14, 4, 12, RED_COAT);
                        box(22, 14, 1, 12, 0x880000); // Coat shadow
                        box(19, 24, 4, 2, BLACK); // Flames
                    }
                }
                
                // Arms
                if (isSageMode) {
                    box(6, 14, 4, 6, RED_COAT); box(22, 14, 4, 6, RED_COAT); // Coat sleeves
                    box(6, 14, 1, 6, 0x880000); box(25, 14, 1, 6, 0x880000); // Sleeve shadow
                    box(7, 20, 3, 3, skinColor); box(22, 20, 3, 3, skinColor); // Hands
                    box(7, 22, 3, 1, 0xcc9977); box(22, 22, 3, 1, 0xcc9977); // Hand shadow
                } else {
                    box(8, 14, 3, 6, suitColor); box(21, 14, 3, 6, suitColor);
                    box(8, 14, 1, 6, suitShadow); box(23, 14, 1, 6, suitShadow); // Arm shadow
                    box(8, 20, 3, 3, skinColor); box(21, 20, 3, 3, skinColor); // Hands
                    box(8, 22, 3, 1, 0xcc9977); box(21, 22, 3, 1, 0xcc9977); // Hand shadow
                }
                
                // Head
                headBox(12, 6, 8, 7, skinColor);
                headBox(12, 6, 1, 7, 0xcc9977); headBox(19, 6, 1, 7, 0xcc9977); // Face shadow
                
                // Headband
                if (isKuramaMode) {
                    headBox(11, 5, 10, 2, suitColor);
                    headBox(13, 5, 6, 2, K_BLACK); // Plate
                } else {
                    headBox(11, 5, 10, 2, BLUE); // Blue headband
                    headBox(13, 5, 6, 2, 0xaaaaaa); // Metal plate
                }
                
                // Eyes
                if (isKuramaMode) {
                    headBox(13, 8, 2, 2, K_ORANGE); headBox(17, 8, 2, 2, K_ORANGE);
                    headDot(13, 8, K_BLACK); headDot(17, 8, K_BLACK); // Cross/slit pupils
                } else if (isSageMode) {
                    // Orange pigmentation around eyes (subtle border)
                    headBox(12, 7, 4, 3, SAGE_ORANGE); headBox(16, 7, 4, 3, SAGE_ORANGE);
                    // Yellow eyes
                    headBox(13, 8, 2, 2, K_YELLOW); headBox(17, 8, 2, 2, K_YELLOW);
                    // Horizontal slit pupils
                    headBox(13, 8, 2, 1, BLACK); headBox(17, 8, 2, 1, BLACK);
                } else {
                    headBox(13, 8, 2, 2, WHITE); headBox(17, 8, 2, 2, WHITE);
                    headDot(14, 8, BLUE); headDot(17, 8, BLUE);
                }
                
                // Whisker marks
                const whiskerColor = isKuramaMode ? K_BLACK : 0x884422;
                // Thicker whiskers for Kurama mode
                if (isKuramaMode) {
                    headBox(11, 10, 3, 1, whiskerColor); headBox(11, 12, 3, 1, whiskerColor);
                    headBox(18, 10, 3, 1, whiskerColor); headBox(18, 12, 3, 1, whiskerColor);
                } else {
                    headBox(12, 10, 2, 1, whiskerColor); headBox(12, 12, 2, 1, whiskerColor);
                    headBox(18, 10, 2, 1, whiskerColor); headBox(18, 12, 2, 1, whiskerColor);
                }
                
                // Spiky Hair
                if (isKuramaMode) {
                    // Even more massive spiky hair
                    headBox(10, 0, 12, 5, hairColor);
                    headBox(12, -4, 3, 4, hairColor); headBox(17, -4, 3, 4, hairColor);
                    headBox(14, -6, 4, 6, hairColor);
                    headBox(8, 2, 3, 4, hairColor); headBox(21, 2, 3, 4, hairColor);
                    // Horn-like chakra spikes
                    headBox(10, -8, 2, 6, hairColor); headBox(20, -8, 2, 6, hairColor);
                } else {
                    headBox(11, 2, 10, 3, hairColor);
                    headBox(12, -1, 3, 3, hairColor); headBox(17, -1, 3, 3, hairColor);
                    headBox(14, -3, 4, 5, hairColor);
                    headBox(9, 3, 3, 3, hairColor); headBox(20, 3, 3, 3, hairColor);
                    // Sideburns
                    headBox(11, 5, 1, 3, hairColor); headBox(20, 5, 1, 3, hairColor);
                }
                break;
            }
            case 'chapolim': {
                const RED = 0xe74c3c;
                const RED_SHADOW = 0xc0392b;
                const YELLOW = 0xf1c40f;
                const SKIN = 0xffce9e;
                const BLACK = 0x111111;
                
                // Chipote Chillón (Mallet) in hand (drawn first to be behind)
                const malletY = (f % 2 === 0) ? 14 : 15;
                // Handle
                box(23, malletY - 2, 2, 12, YELLOW);
                box(24, malletY - 2, 1, 12, 0xccaa00); // Handle shadow
                // Head (Red with yellow sides)
                box(21, malletY - 6, 6, 8, RED);
                box(21, malletY - 6, 1, 8, RED_SHADOW); box(26, malletY - 6, 1, 8, RED_SHADOW); // Mallet shadow
                box(20, malletY - 4, 8, 4, YELLOW);
                box(20, malletY - 4, 1, 4, 0xccaa00); box(27, malletY - 4, 1, 4, 0xccaa00); // Yellow side shadow
                
                // Legs (Red tights, yellow shorts, yellow shoes)
                box(11, 24, 4, 6, RED); box(17, 24, 4, 6, RED);
                box(11, 24, 1, 6, RED_SHADOW); box(20, 24, 1, 6, RED_SHADOW); // Leg shadow
                box(10, 22, 12, 4, YELLOW); // Shorts
                box(10, 25, 12, 1, 0xccaa00); // Shorts shadow
                box(11, 28, 4, 3, YELLOW); box(17, 28, 4, 3, YELLOW); // Shoes
                box(11, 28, 1, 3, 0xccaa00); box(17, 28, 1, 3, 0xccaa00); // Shoe shadow
                box(11, 30, 4, 1, BLACK); box(17, 30, 4, 1, BLACK); // Soles
                
                // Torso (Red suit with yellow heart)
                box(10, 14, 12, 10, RED);
                box(11, 14, 10, 10, RED_SHADOW);
                // Torso shadow
                box(10, 14, 1, 10, RED_SHADOW); box(21, 14, 1, 10, RED_SHADOW);
                // Yellow Heart (approximate)
                box(13, 16, 6, 5, YELLOW);
                box(12, 16, 8, 2, YELLOW);
                box(14, 21, 4, 1, YELLOW);
                // "CH" in red (just two dots for scale)
                dot(14, 17, RED); dot(17, 17, RED);
                
                // Arms (Red sleeves, skin hands)
                box(7, 14, 3, 7, RED); box(22, 14, 3, 7, RED);
                box(7, 14, 1, 7, RED_SHADOW); box(24, 14, 1, 7, RED_SHADOW); // Arm shadow
                box(7, 21, 3, 2, SKIN); box(22, 21, 3, 2, SKIN); // Hands
                box(7, 22, 3, 1, 0xccaa88); box(22, 22, 3, 1, 0xccaa88); // Hand shadow
                
                // Head (Red hood, skin face)
                headBox(11, 5, 10, 9, RED); // Hood
                headBox(11, 5, 1, 9, RED_SHADOW); headBox(20, 5, 1, 9, RED_SHADOW); // Hood shadow
                headBox(12, 7, 8, 6, SKIN); // Face
                headBox(12, 7, 1, 6, 0xccaa88); headBox(19, 7, 1, 6, 0xccaa88); // Face shadow
                headDot(14, 9, BLACK); headDot(17, 9, BLACK); // Eyes
                
                // Antennas (Vinil)
                headBox(12, 2, 1, 4, RED); headBox(19, 2, 1, 4, RED);
                headBox(11, 1, 3, 2, YELLOW); headBox(18, 1, 3, 2, YELLOW); // Tips
                headBox(11, 2, 3, 1, 0xccaa00); headBox(18, 2, 3, 1, 0xccaa00); // Tip shadow
                break;
            }
            case 'batman': {
                const isArmored = form === 1;
                const SUIT_GREY = isArmored ? 0x2c3e50 : 0x34495e;
                const SUIT_SHADOW = isArmored ? 0x1a252f : 0x2c3e50;
                const BLACK = 0x111111;
                const YELLOW = 0xf1c40f;
                const SKIN = 0xffce9e;
                const ARMOR_GLOW = 0x00ffff; // Cyan glow for armored eyes

                // Cape (Drawn first to be behind)
                const capeColor = isArmored ? 0x1a1a1a : 0x000000;
                box(6, 14, 20, 18, capeColor);
                box(5, 16, 22, 14, capeColor);
                // Scalloped edges
                dot(7, 32, capeColor); dot(11, 32, capeColor); dot(15, 32, capeColor); dot(19, 32, capeColor); dot(23, 32, capeColor);

                // Legs
                box(11, 24, 4, 6, SUIT_GREY); box(17, 24, 4, 6, SUIT_GREY);
                box(11, 24, 1, 6, SUIT_SHADOW); box(20, 24, 1, 6, SUIT_SHADOW); // Leg shadow
                // Boots
                box(10, 28, 5, 4, BLACK); box(17, 28, 5, 4, BLACK);
                box(10, 31, 5, 1, 0x000000); box(17, 31, 5, 1, 0x000000); // Boot shadow
                if (isArmored) {
                    // Armor plates on legs
                    box(11, 25, 4, 2, 0x7f8c8d); box(17, 25, 4, 2, 0x7f8c8d);
                    box(11, 26, 4, 1, 0x556666); box(17, 26, 4, 1, 0x556666); // Plate shadow
                }

                // Torso
                box(10, 14, 12, 10, SUIT_GREY);
                box(10, 14, 1, 10, SUIT_SHADOW); box(21, 14, 1, 10, SUIT_SHADOW); // Torso shadow
                // Bat Symbol
                box(13, 16, 6, 3, BLACK);
                dot(12, 16, BLACK); dot(19, 16, BLACK); // Wings
                dot(15, 15, BLACK); dot(16, 15, BLACK); // Ears of the bat
                
                // Utility Belt
                box(10, 22, 12, 2, YELLOW);
                box(10, 23, 12, 1, 0xccaa00); // Belt shadow
                box(11, 22, 2, 2, 0xd4ac0d); // Pouches
                box(15, 22, 2, 2, 0xd4ac0d);
                box(19, 22, 2, 2, 0xd4ac0d);

                // Arms
                box(7, 14, 3, 7, SUIT_GREY); box(22, 14, 3, 7, SUIT_GREY);
                box(7, 14, 1, 7, SUIT_SHADOW); box(24, 14, 1, 7, SUIT_SHADOW); // Arm shadow
                // Gauntlets
                box(6, 18, 4, 5, BLACK); box(22, 18, 4, 5, BLACK);
                box(6, 22, 4, 1, 0x000000); box(22, 22, 4, 1, 0x000000); // Gauntlet shadow
                // Fins on gauntlets
                dot(5, 19, BLACK); dot(5, 21, BLACK);
                dot(26, 19, BLACK); dot(26, 21, BLACK);

                // Head (Cowl)
                headBox(11, 5, 10, 9, BLACK);
                headBox(11, 5, 1, 9, 0x000000); headBox(20, 5, 1, 9, 0x000000); // Cowl shadow
                if (isArmored) {
                   headBox(12, 7, 8, 6, 0x34495e); // Metal faceplate
                   headBox(12, 7, 1, 6, 0x1a252f); headBox(19, 7, 1, 6, 0x1a252f); // Faceplate shadow
                   headBox(13, 9, 2, 1, ARMOR_GLOW); headBox(17, 9, 2, 1, ARMOR_GLOW); // Glowing eyes
                } else {
                   headBox(12, 8, 8, 5, SKIN); // Face opening
                   headBox(12, 8, 1, 5, 0xccaa88); headBox(19, 8, 1, 5, 0xccaa88); // Face shadow
                   headBox(13, 9, 2, 1, 0xffffff); headBox(17, 9, 2, 1, 0xffffff); // White eyes
                   headBox(12, 11, 8, 2, SKIN); // Chin
                }
                
                // Bat Ears
                headBox(11, 2, 2, 4, BLACK); headBox(19, 2, 2, 4, BLACK);
                break;
            }
            case 'thukuna': {
                const isTransformed = form === 1;
                const SKIN = 0xffd3b6;
                const SKIN_SHADOW = 0xe0ac88;
                const HAIR = 0xffa6c9; // Salmon pink
                const HAIR_SHADOW = 0x1a1a1a; // Dark undercut
                const TATTOO = 0x111111;
                const PANTS = 0x1e272e;
                const SHOES = 0x8b0000;
                
                const ROBE_NORMAL = 0x1e272e;
                const ROBE_NORMAL_SHADOW = 0x0f1417;
                const HOOD = 0xc0392b;
                
                const ROBE_TRANS = 0xf5f6fa;
                const ROBE_TRANS_SHADOW = 0xdcdde1;
                const SASH = 0x2f3640;

                // Legs
                box(11, 24, 4, 5, PANTS); box(17, 24, 4, 5, PANTS);
                box(11, 24, 1, 5, 0x0f1417); box(20, 24, 1, 5, 0x0f1417); // Pants shadow
                
                // Shoes
                box(10, 29, 5, 3, SHOES); box(17, 29, 5, 3, SHOES);
                box(10, 31, 5, 1, 0x590000); box(17, 31, 5, 1, 0x590000); // Shoe soles
                
                if (isTransformed) {
                    // TRUE FORM (Heian Era)
                    
                    // Extra Arms (Lower/Back) - thinner and positioned better
                    box(8, 16, 2, 6, SKIN); box(22, 16, 2, 6, SKIN); // Extra arms
                    box(8, 16, 1, 6, SKIN_SHADOW); box(23, 16, 1, 6, SKIN_SHADOW); // Extra arm shadow
                    box(8, 20, 2, 2, TATTOO); box(22, 20, 2, 2, TATTOO); // Wrist tattoos
                    
                    // Main Arms - proportionate
                    box(9, 14, 3, 7, SKIN); box(20, 14, 3, 7, SKIN);
                    box(9, 14, 1, 7, SKIN_SHADOW); box(22, 14, 1, 7, SKIN_SHADOW); // Main arm shadow
                    box(9, 18, 3, 3, SKIN_SHADOW); box(20, 18, 3, 3, SKIN_SHADOW); // Forearm shading
                    box(9, 16, 3, 1, TATTOO); box(20, 16, 3, 1, TATTOO); // Arm bands
                    box(9, 19, 3, 1, TATTOO); box(20, 19, 3, 1, TATTOO);
                    
                    // Torso (Exposed chest) - slimmer
                    box(12, 14, 8, 5, SKIN); // Exposed chest
                    box(12, 14, 1, 5, SKIN_SHADOW); box(19, 14, 1, 5, SKIN_SHADOW); // Chest shadow
                    box(14, 17, 4, 1, SKIN_SHADOW); // Abs shading
                    
                    // Chest Tattoos
                    box(13, 15, 6, 1, TATTOO); // Collarbone line
                    box(15, 16, 2, 3, TATTOO); // Center chest
                    
                    // Sash (Obi)
                    box(11, 18, 10, 3, SASH);
                    box(11, 20, 10, 1, 0x1a1a1a); // Sash bottom shadow
                    
                    // Sash Knot & Dangle
                    box(14, 18, 4, 3, 0x1a1a1a); // Knot
                    box(14, 21, 3, 5, SASH); // Dangling fabric
                    box(16, 21, 1, 5, 0x1a1a1a); // Dangle shadow
                    
                    // White Hakama (Baggy Pants)
                    // Left Leg
                    box(9, 21, 6, 8, ROBE_TRANS); // Main left leg
                    box(8, 25, 2, 4, ROBE_TRANS); // Left flare
                    box(9, 21, 1, 8, ROBE_TRANS_SHADOW); // Left outer shadow
                    box(11, 22, 1, 7, ROBE_TRANS_SHADOW); // Left fold 1
                    box(13, 21, 1, 8, ROBE_TRANS_SHADOW); // Left fold 2
                    box(14, 21, 1, 8, 0xc8c9ce); // Left inner deep shadow
                    
                    // Right Leg
                    box(17, 21, 6, 8, ROBE_TRANS); // Main right leg
                    box(22, 25, 2, 4, ROBE_TRANS); // Right flare
                    box(22, 21, 1, 8, ROBE_TRANS_SHADOW); // Right outer shadow
                    box(20, 22, 1, 7, ROBE_TRANS_SHADOW); // Right fold 1
                    box(18, 21, 1, 8, ROBE_TRANS_SHADOW); // Right fold 2
                    box(17, 21, 1, 8, 0xc8c9ce); // Right inner deep shadow
                    
                    // Crotch connection
                    box(15, 21, 2, 4, ROBE_TRANS_SHADOW); 
                    box(15, 21, 2, 2, ROBE_TRANS);
                    
                    // Head - standard size
                    headBox(12, 6, 8, 8, SKIN);
                    // Right side face deformity (Heian mask)
                    headBox(16, 5, 5, 9, SKIN_SHADOW); // Mask base
                    headBox(17, 6, 3, 7, 0xcc9977); // Mask detail
                    
                    // Hair (Spikier, wilder)
                    headBox(11, 2, 10, 4, HAIR);
                    headBox(10, 4, 2, 4, HAIR); headBox(20, 4, 2, 4, HAIR);
                    headBox(12, 0, 2, 3, HAIR); headBox(15, -1, 2, 3, HAIR); headBox(18, 0, 2, 3, HAIR);
                    
                    // Eyebrows
                    headBox(13, 8, 2, 1, HAIR); headBox(17, 8, 2, 1, HAIR);
                    
                    // Eyes (4 eyes)
                    headBox(13, 9, 2, 1, 0xffffff); headBox(17, 9, 2, 1, 0xffffff); // Main Sclera
                    headBox(14, 9, 1, 1, 0xff0000); headBox(17, 9, 1, 1, 0xff0000); // Main Pupils
                    
                    headBox(17, 11, 2, 1, 0xffffff); // Extra right eye lower
                    headBox(17, 11, 1, 1, 0xff0000);
                    headBox(17, 7, 2, 1, 0xffffff); // Extra right eye upper
                    headBox(17, 7, 1, 1, 0xff0000);
                    
                    // Nose
                    headBox(15, 11, 2, 1, SKIN_SHADOW);
                    
                    // Face Tattoos (Removed under-eye and forehead lines to clean up face)
                    
                } else {
                    // YUJI FORM
                    
                    // Arms (Uniform sleeves)
                    box(7, 14, 3, 7, ROBE_NORMAL); box(22, 14, 3, 7, ROBE_NORMAL);
                    box(7, 14, 1, 7, ROBE_NORMAL_SHADOW); box(24, 14, 1, 7, ROBE_NORMAL_SHADOW);
                    
                    // Hands
                    box(7, 21, 3, 2, SKIN); box(22, 21, 3, 2, SKIN);
                    box(7, 21, 3, 1, TATTOO); box(22, 21, 3, 1, TATTOO); // Hand tattoos
                    box(7, 22, 3, 1, SKIN_SHADOW); box(22, 22, 3, 1, SKIN_SHADOW); // Hand shadow
                    
                    // Torso (Uniform)
                    box(10, 14, 12, 10, ROBE_NORMAL);
                    box(10, 14, 2, 10, ROBE_NORMAL_SHADOW); box(20, 14, 2, 10, ROBE_NORMAL_SHADOW);
                    
                    // Red Hood
                    box(11, 13, 10, 3, HOOD);
                    box(11, 15, 10, 1, 0x8b0000); // Hood shadow
                    
                    // Head
                    headBox(11, 5, 10, 9, SKIN);
                    headBox(11, 5, 1, 9, SKIN_SHADOW); headBox(20, 5, 1, 9, SKIN_SHADOW); // Face shadow
                    
                    // Hair (Undercut + Spiky top)
                    headBox(10, 5, 1, 4, HAIR_SHADOW); headBox(21, 5, 1, 4, HAIR_SHADOW); // Undercut
                    headBox(10, 2, 12, 3, HAIR);
                    headBox(11, 1, 3, 2, HAIR); headBox(15, 0, 2, 2, HAIR); headBox(18, 1, 3, 2, HAIR);
                    
                    // Face Tattoos (Removed under-eye and forehead lines to clean up face)
                    headBox(15, 11, 2, 1, TATTOO); // Chin
                    headBox(11, 9, 1, 1, TATTOO); headBox(20, 9, 1, 1, TATTOO); // Cheeks
                    
                    // Eyes
                    headBox(12, 8, 2, 1, 0xffffff); headBox(18, 8, 2, 1, 0xffffff); // Sclera
                    headBox(13, 8, 1, 1, 0xff0000); headBox(18, 8, 1, 1, 0xff0000); // Red pupils
                }
                break;
            }
            case 'gojo': {
                const isTransformed = form === 1;
                const SKIN = 0xffeebb;
                const SKIN_SHADOW = 0xccbb99;
                const HAIR = 0xffffff;
                const HAIR_SHADOW = 0xdddddd;
                const JACKET = 0x1a1a24;
                const JACKET_SHADOW = 0x0f0f15;
                const PANTS = 0x1a1a24;
                const PANTS_SHADOW = 0x0f0f15;
                const SHOES = 0x111111;
                const BLINDFOLD = 0x111111;
                const EYE_BLUE = 0x00ffff;
                const EYE_WHITE = 0xffffff;

                // Legs
                box(11, 24, 4, 6, PANTS); box(17, 24, 4, 6, PANTS);
                box(11, 24, 1, 6, PANTS_SHADOW); box(20, 24, 1, 6, PANTS_SHADOW); // Pants shadow
                
                // Shoes
                box(10, 30, 5, 2, SHOES); box(17, 30, 5, 2, SHOES);
                
                // Torso (Jacket)
                box(10, 14, 12, 10, JACKET);
                box(10, 14, 2, 10, JACKET_SHADOW); box(20, 14, 2, 10, JACKET_SHADOW); // Jacket shadow
                box(15, 14, 2, 10, JACKET_SHADOW); // Zipper line
                
                // Arms
                box(7, 14, 3, 8, JACKET); box(22, 14, 3, 8, JACKET);
                box(7, 14, 1, 8, JACKET_SHADOW); box(24, 14, 1, 8, JACKET_SHADOW); // Arm shadow
                
                // Hands
                box(7, 22, 3, 2, SKIN); box(22, 22, 3, 2, SKIN);
                box(7, 22, 1, 2, SKIN_SHADOW); box(24, 22, 1, 2, SKIN_SHADOW); // Hand shadow
                
                // Head
                headBox(12, 6, 8, 8, SKIN);
                headBox(12, 6, 1, 8, SKIN_SHADOW); headBox(19, 6, 1, 8, SKIN_SHADOW); // Face shadow
                
                if (isTransformed) {
                    // LIMITLESS / SIX EYES (Blindfold off, floating hair)
                    
                    // Hair (Spiky, floating up)
                    headBox(10, 0, 12, 6, HAIR); 
                    headBox(11, -2, 10, 2, HAIR);
                    headBox(12, -4, 8, 2, HAIR);
                    headBox(14, -6, 4, 2, HAIR);
                    
                    // Hair shadow
                    headBox(10, 0, 2, 6, HAIR_SHADOW); headBox(20, 0, 2, 6, HAIR_SHADOW);
                    
                    // Eyes (Six Eyes)
                    headBox(13, 9, 2, 2, EYE_WHITE); headBox(17, 9, 2, 2, EYE_WHITE); // Sclera
                    headBox(13, 9, 2, 1, EYE_BLUE); headBox(17, 9, 2, 1, EYE_BLUE); // Bright blue iris
                    headBox(14, 9, 1, 1, 0xffffff); headBox(18, 9, 1, 1, 0xffffff); // Eye shine
                    
                    // Eyebrows
                    headBox(13, 7, 2, 1, HAIR); headBox(17, 7, 2, 1, HAIR);
                    
                    // Smile
                    headBox(15, 12, 2, 1, SKIN_SHADOW);
                    
                } else {
                    // BASE FORM (Blindfold on, hair down)
                    
                    // Hair (Swept down)
                    headBox(10, 2, 12, 5, HAIR);
                    headBox(11, 0, 10, 2, HAIR);
                    headBox(13, -2, 6, 2, HAIR);
                    // Bangs over blindfold
                    headBox(11, 7, 2, 3, HAIR); headBox(14, 7, 4, 2, HAIR); headBox(19, 7, 2, 3, HAIR);
                    
                    // Hair shadow
                    headBox(10, 2, 2, 5, HAIR_SHADOW); headBox(20, 2, 2, 5, HAIR_SHADOW);
                    
                    // Blindfold
                    headBox(11, 8, 10, 3, BLINDFOLD);
                    headBox(11, 8, 10, 1, 0x222222); // Blindfold highlight
                    
                    // Smile
                    headBox(15, 12, 2, 1, SKIN_SHADOW);
                }
                break;
            }
        }
    } // End Loop

    let textureName = key;
    if (isUI) textureName = `${key}_ui`;
    else if (isTransformed) textureName = `${key}_ssj`;

    canvas.generateTexture(textureName, sheetWidth, sheetHeight);
    
    // Manually add frame data to the new texture so Phaser knows it's a spritesheet
    if (this.textures.exists(textureName)) {
        const tex = this.textures.get(textureName);
        const fw = FRAME_WIDTH * SCALE;
        const fh = FRAME_HEIGHT * SCALE;
        for(let i=0; i<FRAMES; i++) {
            tex.add(i.toString(), 0, i * fw, 0, fw, fh);
        }
    }
    
    canvas.destroy();
  }
}
