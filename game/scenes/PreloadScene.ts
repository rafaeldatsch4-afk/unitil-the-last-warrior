
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
    const FRAMES = 4;
    
    // Calculate total dimensions
    const sheetWidth = FRAME_WIDTH * SCALE * FRAMES;
    const sheetHeight = FRAME_HEIGHT * SCALE;

    const canvas = this.make.graphics({ x: 0, y: 0 });
    
    // Loop to draw 4 frames side by side
    for(let f = 0; f < FRAMES; f++) {
        const offsetX = f * FRAME_WIDTH;
        
        // ANIMATION LOGIC: Breathing / Bobbing
        // Note: y coordinates below 22 are bobbed. DRAW_OFFSET_Y is added to final position.
        const breatheOffset = (f === 1 || f === 3) ? 1 : 0;
        
        const dot = (x: number, y: number, color: number) => {
            const finalY = (y < 22) ? y + breatheOffset : y;
            canvas.fillStyle(color, 1);
            canvas.fillRect((offsetX + x) * SCALE, (finalY + DRAW_OFFSET_Y) * SCALE, SCALE, SCALE);
        };

        const box = (x: number, y: number, w: number, h: number, color: number) => {
            const finalY = (y < 22) ? y + breatheOffset : y;
            canvas.fillStyle(color, 1);
            canvas.fillRect((offsetX + x) * SCALE, (finalY + DRAW_OFFSET_Y) * SCALE, w * SCALE, h * SCALE);
        };

        const headBox = (x: number, y: number, w: number, h: number, color: number) => {
            canvas.fillStyle(color, 1);
            canvas.fillRect((offsetX + x) * SCALE, (y + breatheOffset + DRAW_OFFSET_Y) * SCALE, w * SCALE, h * SCALE);
        };
        const headDot = (x: number, y: number, color: number) => {
            canvas.fillStyle(color, 1);
            canvas.fillRect((offsetX + x) * SCALE, (y + breatheOffset + DRAW_OFFSET_Y) * SCALE, SCALE, SCALE);
        };

        const SKIN = 0xffcc99;
        const WHITE = 0xffffff;
        const BLACK = 0x111111;

        switch(key) {
            case 'goku': {
                // DBZ PALETTE
                const GI_ORANGE = 0xf85b1a; 
                const GI_SHADOW = 0xc4410b;
                const GI_BLUE = 0x002255;   
                const SASH_BLUE = 0x002255;
                const SKIN_TONE = 0xffce9e; 
                const SKIN_SHADOW = 0xe0ac7d;
                const BOOT_RED = 0xd92525;
                const BOOT_ROPE = 0xeaddcf;
                const HAIR_BLACK = 0x1a1a1a; 
                
                // SSJ PALETTE
                const HAIR_SSJ_GOLD = 0xffd93b; 
                const HAIR_SSJ_SHADOW = 0xcfa721;
                const HAIR_SSJ_LIGHT = 0xffffaa;
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
                box(10, 23, 1, 6, GI_SHADOW); box(21, 23, 1, 6, GI_SHADOW);
                // Boots (Classic Z style)
                box(10, 29, 4, 3, GI_BLUE); box(18, 29, 4, 3, GI_BLUE);
                box(10, 29, 4, 1, BOOT_ROPE); box(18, 29, 4, 1, BOOT_ROPE);
                box(12, 29, 1, 3, BOOT_RED); box(20, 29, 1, 3, BOOT_RED); // Vertical stripe
                box(10, 31, 4, 1, GI_BLUE); box(18, 31, 4, 1, GI_BLUE);

                // Torso
                box(11, 14, 10, 9, GI_ORANGE);
                box(13, 14, 6, 4, GI_BLUE); // Undershirt
                box(14, 14, 4, 2, SKIN_TONE); // Neck
                dot(15, 16, SKIN_TONE); // V-neck dip
                box(19, 17, 2, 6, GI_SHADOW); // Shading

                // Sash with knot
                box(11, 22, 10, 2, SASH_BLUE);
                const knotY = (f % 2 === 0) ? 23 : 24; 
                box(11, 23, 2, 4, SASH_BLUE); dot(12, 27, SASH_BLUE);

                if (!isUI) {
                    // Kanji Symbol (Turtle/Kai)
                    box(17, 16, 3, 3, 0xffffff); dot(18, 17, 0x111111);
                }

                // Arms (Wristbands)
                box(8, 14, 3, 4, GI_ORANGE); box(21, 14, 3, 4, GI_ORANGE);
                box(8, 18, 3, 3, SKIN_TONE); box(21, 18, 3, 3, SKIN_TONE);
                box(8, 20, 3, 3, GI_BLUE); box(21, 20, 3, 3, GI_BLUE); // Wristband
                box(8, 23, 3, 2, SKIN_TONE); box(21, 23, 3, 2, SKIN_TONE); // Hands

                // Head
                headBox(12, 6, 8, 7, SKIN_TONE);
                headDot(11, 9, SKIN_TONE); headDot(20, 9, SKIN_TONE); // Ears
                headBox(13, 12, 6, 1, SKIN_SHADOW);
                
                // Face
                headDot(13, 9, WHITE); headDot(17, 9, WHITE); 
                headDot(14, 9, eyeColor); headDot(17, 9, eyeColor);
                headDot(13, 8, eyebrowColor); headDot(14, 8, eyebrowColor);
                headDot(17, 8, eyebrowColor); headDot(18, 8, eyebrowColor);
                headDot(15, 11, 0xdca880); // Nose

                canvas.fillStyle(hairColor, 1);
                
                // GOKU HAIR (Same shape for all forms, just different color)
                // Main Volume
                headBox(11, 2, 10, 6, hairColor); 
                headBox(14, 0, 4, 2, hairColor); // Top bump
                
                // Spikes Left (Curved)
                headBox(9, 3, 2, 4, hairColor); headDot(8, 5, hairColor);
                headBox(7, 4, 2, 3, hairColor);
                
                // Spikes Right
                headBox(21, 3, 2, 3, hairColor); headDot(23, 5, hairColor);
                
                // Bangs (Base)
                headBox(13, 6, 2, 2, hairColor);
                headBox(16, 6, 3, 2, hairColor);
                
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
                
                // Boots (pointed tips, rounded tops)
                box(11, 28, 4, 3, ARMOR_WHITE); box(17, 28, 4, 3, ARMOR_WHITE);
                box(10, 30, 5, 2, ARMOR_WHITE); box(17, 30, 5, 2, ARMOR_WHITE);
                box(10, 31, 5, 1, GOLD); box(17, 31, 5, 1, GOLD);
                dot(10, 30, GOLD); dot(14, 30, GOLD); dot(17, 30, GOLD); dot(21, 30, GOLD); // Gold tips shape
                box(12, 28, 2, 3, ARMOR_SHADOW); box(18, 28, 2, 3, ARMOR_SHADOW); // Boot shadow
                
                // Torso (Suit underneath)
                box(12, 19, 8, 5, SUIT_BLUE);
                box(13, 19, 6, 5, SUIT_LIGHT);
                
                // Armor (Chest piece)
                box(11, 14, 10, 5, ARMOR_WHITE); // Main chest
                box(12, 17, 8, 2, ARMOR_SHADOW); // Abdomen segments
                box(11, 14, 2, 5, GOLD); box(19, 14, 2, 5, GOLD); // Straps/Side gold
                box(13, 15, 6, 2, ARMOR_DARK); // Chest lines
                
                // Shoulders (Iconic pointy pads)
                box(7, 13, 4, 2, GOLD); box(6, 14, 5, 2, ARMOR_WHITE);
                dot(6, 13, GOLD); dot(5, 14, ARMOR_WHITE); // Left tip
                box(21, 13, 4, 2, GOLD); box(21, 14, 5, 2, ARMOR_WHITE);
                dot(25, 13, GOLD); dot(26, 14, ARMOR_WHITE); // Right tip
                
                // Arms
                box(8, 16, 3, 4, SUIT_BLUE); box(21, 16, 3, 4, SUIT_BLUE);
                
                // Gloves
                box(7, 20, 4, 4, ARMOR_WHITE); box(21, 20, 4, 4, ARMOR_WHITE);
                box(8, 20, 2, 4, ARMOR_SHADOW); box(22, 20, 2, 4, ARMOR_SHADOW);
                
                // Head/Face (Less blocky)
                headBox(12, 5, 8, 7, SKIN); // Face base
                headBox(13, 12, 6, 1, SKIN); // Chin
                
                // Eyes & Brow
                headBox(13, 8, 2, 1, WHITE); headBox(17, 8, 2, 1, WHITE); // Whites
                headDot(14, 8, EYE); headDot(17, 8, EYE); // Pupils
                headBox(12, 7, 3, 1, BROW); headBox(17, 7, 3, 1, BROW); // Angry brows
                headDot(14, 7, SKIN); headDot(17, 7, SKIN); // Angle the brows
                
                // Hair (Vegeta's flame shape & widow's peak)
                headBox(12, 1, 8, 4, HAIR);
                headBox(11, 2, 10, 3, HAIR);
                headBox(13, -1, 6, 2, HAIR);
                headDot(14, -2, HAIR); headDot(17, -2, HAIR);
                headDot(15, 5, HAIR); headDot(16, 5, HAIR); // Widow's peak center
                headDot(14, 4, HAIR); headDot(17, 4, HAIR); // Widow's peak sides
                headDot(12, 5, HAIR); headDot(19, 5, HAIR); // Sideburns top
                headDot(12, 6, HAIR); headDot(19, 6, HAIR); // Sideburns bottom
                
                if (isTransformed) {
                    // Taller, spikier hair for SSJ/UE
                    headBox(12, 0, 8, 5, HAIR);
                    headBox(13, -2, 6, 2, HAIR);
                    headDot(14, -3, HAIR); headDot(17, -3, HAIR);
                    headDot(10, 2, HAIR); headDot(21, 2, HAIR);
                }
                break;
            }
            case 'piccolo': {
                const GREEN_SKIN = 0x90d06c; const GREEN_SHADOW = 0x5a8f3d; const MUSCLE_PINK = 0xe08e9d; const GI_PURPLE = 0x3a225d; const GI_SHADOW = 0x221238; const SASH_BLUE = 0x5fb0e6; const SHOE_BROWN = 0x8a5a2b; const WHITE_CAPE = 0xf8f8f8; const CAPE_SHADOW = 0xdcdcdc; const ORANGE_SKIN = 0xff9900; const ORANGE_SHADOW = 0xcc7700; const RED_EYES = 0xff0000;
                const skin = isTransformed ? ORANGE_SKIN : GREEN_SKIN; const skinShadow = isTransformed ? ORANGE_SHADOW : GREEN_SHADOW; const eyeColor = isTransformed ? RED_EYES : BLACK;
                box(10, 23, 4, 7, GI_PURPLE); box(18, 23, 4, 7, GI_PURPLE); box(10, 23, 1, 7, GI_SHADOW); box(21, 23, 1, 7, GI_SHADOW); box(10, 30, 4, 2, SHOE_BROWN); box(18, 30, 4, 2, SHOE_BROWN); dot(11, 30, 0x603010); dot(12, 30, 0x603010); 
                box(11, 14, 10, 9, GI_PURPLE); box(11, 21, 10, 3, SASH_BLUE); box(14, 22, 4, 2, 0x4a90c0); box(13, 13, 6, 3, skin);
                box(7, 15, 4, 8, skin); box(21, 15, 4, 8, skin); if(!isTransformed) { const patchColor = MUSCLE_PINK; box(8, 16, 2, 2, patchColor); box(8, 19, 2, 2, patchColor); box(22, 16, 2, 2, patchColor); box(22, 19, 2, 2, patchColor); } box(8, 21, 3, 2, 0xbb3333); box(21, 21, 3, 2, 0xbb3333); box(8, 23, 3, 2, skin); box(21, 23, 3, 2, skin); dot(8, 24, 0x222222); dot(23, 24, 0x222222);
                headBox(12, 6, 8, 7, skin); headDot(13, 12, skinShadow); headDot(14, 12, skinShadow); headDot(11, 8, skin); headDot(11, 9, skin); headDot(20, 8, skin); headDot(20, 9, skin); headDot(13, 9, WHITE); headDot(17, 9, WHITE); headDot(14, 9, eyeColor); headDot(17, 9, eyeColor); headBox(12, 8, 8, 1, skinShadow); headDot(15, 11, 0xaa6655);
                if(isTransformed) { headBox(13, 4, 1, 2, skin); headBox(18, 4, 1, 2, skin); headBox(13, 5, 6, 1, skin); box(6, 15, 1, 5, skin); box(25, 15, 1, 5, skin); } else { headBox(11, 3, 10, 5, WHITE_CAPE); headBox(11, 5, 10, 1, CAPE_SHADOW); headBox(13, 2, 6, 2, GI_PURPLE); headBox(5, 13, 7, 3, WHITE_CAPE); headDot(5, 12, WHITE_CAPE); headBox(20, 13, 7, 3, WHITE_CAPE); headDot(26, 12, WHITE_CAPE); box(11, 13, 10, 3, WHITE_CAPE); } 
                break;
            }
            case 'gohan': {
                const GI_PURPLE = 0x4a235a; // Vibrant purple Demon Gi
                const GI_SHADOW = 0x2e1a47; 
                const SASH_RED = 0xc0392b; 
                const SASH_SHADOW = 0x922b21;
                const SHOE_BROWN = 0x8d6e63; 
                const WRISTBAND_BLUE = 0x2980b9;
                const HAIR_BASE = BLACK; 
                const HAIR_BEAST = 0xf8f9fa; // Very bright silver/white
                const HAIR_SHADOW = 0xced4da;
                const EYE_BEAST = 0xff0000;
                
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
                }

                // Legs
                box(10, 23, 5, 7, GI_PURPLE); box(17, 23, 5, 7, GI_PURPLE);
                box(11, 23, 3, 7, GI_SHADOW); box(18, 23, 3, 7, GI_SHADOW); // Leg folds
                
                // Shoes
                box(9, 30, 6, 2, SHOE_BROWN); box(17, 30, 6, 2, SHOE_BROWN);
                
                // Torso
                box(11, 14, 10, 9, GI_PURPLE);
                box(12, 15, 8, 7, GI_SHADOW); // Chest shading
                
                // Sash
                box(10, 21, 12, 3, SASH_RED);
                box(10, 23, 12, 1, SASH_SHADOW);
                box(10, 22, 2, 4, SASH_RED); // Sash knot hanging
                
                // Arms
                box(7, 15, 4, 4, SKIN); box(21, 15, 4, 4, SKIN); // Shoulders/Biceps
                box(7, 19, 3, 3, SKIN); box(22, 19, 3, 3, SKIN); // Forearms
                
                // Wristbands
                box(7, 21, 3, 2, WRISTBAND_BLUE); box(22, 21, 3, 2, WRISTBAND_BLUE);
                
                // Hands
                box(7, 23, 3, 2, SKIN); box(22, 23, 3, 2, SKIN);
                
                headBox(12, 6, 8, 7, SKIN); 
                
                if (isTransformed) {
                    // Fierce Piercing Red Eyes
                    headBox(12, 9, 3, 2, WHITE); headBox(17, 9, 3, 2, WHITE); 
                    headBox(13, 9, 2, 2, EYE_BEAST); headBox(17, 9, 2, 2, EYE_BEAST);
                    headDot(14, 9, WHITE); headDot(18, 9, WHITE); // Piercing glint
                    
                    // Angled eyebrows (thicker)
                    headBox(11, 7, 4, 2, 0x880000); 
                    headBox(17, 7, 4, 2, 0x880000);
                    headDot(14, 8, 0x880000); headDot(17, 8, 0x880000);
                } else {
                    headBox(12, 9, 3, 2, WHITE); headBox(17, 9, 3, 2, WHITE); 
                    headDot(13, 9, WHITE); headDot(17, 9, WHITE); 
                    headDot(14, 9, eyeColor); headDot(17, 9, eyeColor); 
                }
                headDot(15, 11, 0xcc8866);

                if (isTransformed) { 
                    // Massive gravity-defying silver/white hair
                    headBox(9, 0, 14, 6, hairColor); // Base
                    
                    // Main central-back spike (huge, reaching up to -35)
                    headBox(12, -25, 8, 25, hairColor); 
                    headBox(13, -30, 6, 5, hairColor);
                    headBox(14, -35, 4, 5, hairColor);
                    headBox(15, -38, 2, 3, hairColor);
                    
                    // Left sweeping spikes
                    headBox(5, -15, 7, 15, hairColor);
                    headBox(3, -22, 5, 7, hairColor);
                    headBox(1, -26, 3, 4, hairColor);
                    
                    // Right sweeping spikes
                    headBox(20, -15, 7, 15, hairColor);
                    headBox(24, -22, 5, 7, hairColor);
                    headBox(28, -26, 3, 4, hairColor);
                    
                    // Lower side spikes
                    headBox(3, -5, 6, 10, hairColor);
                    headBox(1, 0, 4, 5, hairColor);
                    headBox(23, -5, 6, 10, hairColor);
                    headBox(27, 0, 4, 5, hairColor);
                    
                    // Front bang (iconic single large bang over the right eye)
                    headBox(12, 6, 5, 10, hairColor);
                    headBox(13, 16, 3, 4, hairColor);
                    headBox(14, 20, 1, 3, hairColor);
                    
                    // Hair shading (light blue/grey)
                    headBox(12, -25, 2, 25, HAIR_SHADOW);
                    headBox(13, -30, 1, 5, HAIR_SHADOW);
                    headBox(5, -15, 2, 15, HAIR_SHADOW);
                    headBox(3, -22, 1, 7, HAIR_SHADOW);
                    headBox(20, -15, 2, 15, HAIR_SHADOW);
                    headBox(24, -22, 1, 7, HAIR_SHADOW);
                    headBox(12, 6, 1, 10, HAIR_SHADOW);
                } else { 
                    // Ultimate Gohan hair (spiky but normal length, one bang)
                    headBox(10, 0, 12, 6, hairColor); 
                    headBox(11, -4, 4, 4, hairColor); 
                    headBox(17, -4, 4, 4, hairColor); 
                    headBox(14, -6, 4, 6, hairColor); 
                    // Bang
                    headBox(13, 6, 3, 4, hairColor);
                    headBox(14, 10, 1, 2, hairColor);
                }
                break;
            }
            case 'frieza': {
                const WHITE_SKIN = 0xf2f5f8; // Sleeker, slightly cool white
                const WHITE_SHADOW = 0xcbd5e1; 
                const PURPLE_GEM = 0x7e22ce; // Vibrant purple
                const PURPLE_HIGHLIGHT = 0xa855f7; 
                const PURPLE_SHADOW = 0x4c1d95;

                const GOLD_SKIN = 0xf59e0b; // Rich gold
                const GOLD_SHADOW = 0xb45309; 
                const GOLD_HIGHLIGHT = 0xfde047;
                const DARK_PURPLE_SKIN = 0x4c1d95; // Dark purple for face/hands/feet
                const DARK_PURPLE_SHADOW = 0x2e1065;
                const DARK_PURPLE_HIGHLIGHT = 0x6d28d9;

                const mainColor = isTransformed ? GOLD_SKIN : WHITE_SKIN;
                const mainShadow = isTransformed ? GOLD_SHADOW : WHITE_SHADOW;
                const mainHighlight = isTransformed ? GOLD_HIGHLIGHT : WHITE_SKIN;
                
                const secondaryColor = isTransformed ? DARK_PURPLE_SKIN : WHITE_SKIN;
                const secondaryShadow = isTransformed ? DARK_PURPLE_SHADOW : WHITE_SHADOW;
                const secondaryHighlight = isTransformed ? DARK_PURPLE_HIGHLIGHT : WHITE_SKIN;

                const gemColor = isTransformed ? mainColor : PURPLE_GEM;
                const gemHighlight = isTransformed ? mainHighlight : PURPLE_HIGHLIGHT;
                const gemShadow = isTransformed ? mainShadow : PURPLE_SHADOW;

                const shinColor = gemColor;
                const shinHighlight = gemHighlight;
                const forearmColor = gemColor;
                const forearmHighlight = gemHighlight;

                const tailY = (f % 2 === 0) ? 22 : 23;
                
                // Tail (drawn first so it's behind the body)
                box(14, tailY, 6, 3, mainColor);      // Base extending right
                box(18, tailY - 2, 4, 4, mainColor);  // Curving up
                box(21, tailY - 6, 3, 5, mainColor);  // Going up
                box(22, tailY - 11, 2, 6, mainColor); // Curving left slightly at top
                box(21, tailY - 14, 2, 4, mainColor); // Tip
                
                // Tail shadow
                box(14, tailY + 2, 6, 1, mainShadow);
                box(18, tailY - 2, 1, 4, mainShadow);
                box(21, tailY - 6, 1, 5, mainShadow);
                box(22, tailY - 11, 1, 6, mainShadow);
                
                // Legs (Thighs)
                box(11, 23, 4, 4, secondaryColor); box(17, 23, 4, 4, secondaryColor);
                box(11, 23, 1, 4, secondaryShadow); box(20, 23, 1, 4, secondaryShadow); // Inner/outer shadow
                
                // Shins
                box(11, 27, 4, 4, shinColor); box(17, 27, 4, 4, shinColor);
                box(12, 27, 2, 4, shinHighlight); box(18, 27, 2, 4, shinHighlight); // Shiny shins
                dot(12, 27, WHITE); dot(18, 27, WHITE); // Shin specular
                
                // Feet (3 toes)
                box(10, 31, 5, 2, secondaryColor); box(17, 31, 5, 2, secondaryColor);
                // Left foot toes
                box(10, 32, 1, 1, secondaryHighlight); box(12, 32, 1, 1, secondaryHighlight); box(14, 32, 1, 1, secondaryHighlight);
                // Right foot toes
                box(17, 32, 1, 1, secondaryHighlight); box(19, 32, 1, 1, secondaryHighlight); box(21, 32, 1, 1, secondaryHighlight);
                // Shadows between toes
                box(11, 32, 1, 1, secondaryShadow); box(13, 32, 1, 1, secondaryShadow);
                box(18, 32, 1, 1, secondaryShadow); box(20, 32, 1, 1, secondaryShadow);
                
                // Torso (Abdomen)
                box(12, 19, 8, 4, secondaryColor);
                box(12, 19, 8, 1, secondaryShadow); // Ribbed texture
                box(12, 21, 8, 1, secondaryShadow); // Ribbed texture
                
                // Torso (Chest)
                box(11, 14, 10, 5, mainColor);
                box(11, 14, 2, 5, mainShadow); box(19, 14, 2, 5, mainShadow); // Chest sides
                
                // Chest Gem
                box(13, 15, 6, 3, gemColor);
                box(14, 15, 4, 1, gemHighlight); // Shiny chest
                dot(14, 15, WHITE); // Specular shine
                
                // Neck
                box(13, 12, 6, 2, secondaryColor);
                box(13, 12, 1, 2, secondaryShadow); box(18, 12, 1, 2, secondaryShadow); // Neck shadow
                
                // Shoulders (Spherical)
                box(7, 13, 5, 4, mainColor);
                box(8, 13, 3, 1, mainHighlight); // Shoulder pad rim shine
                box(8, 14, 3, 2, gemColor);
                box(8, 14, 2, 1, gemHighlight);
                dot(8, 14, WHITE); // Specular shine
                
                box(20, 13, 5, 4, mainColor);
                box(21, 13, 3, 1, mainHighlight); // Shoulder pad rim shine
                box(21, 14, 3, 2, gemColor);
                box(22, 14, 2, 1, gemHighlight);
                dot(22, 14, WHITE); // Specular shine
                
                // Arms
                box(8, 17, 3, 3, secondaryColor); box(21, 17, 3, 3, secondaryColor); // Upper arm
                box(8, 20, 3, 3, forearmColor); box(21, 20, 3, 3, forearmColor); // Forearm
                box(9, 20, 1, 3, forearmHighlight); box(22, 20, 1, 3, forearmHighlight); // Forearm shine
                dot(9, 20, WHITE); dot(22, 20, WHITE); // Forearm specular
                
                // Hands
                box(8, 23, 3, 2, secondaryColor); box(21, 23, 3, 2, secondaryColor);
                
                // Head base (Helmet/Sides)
                headBox(12, 4, 8, 8, mainColor);
                
                // Face plate
                headBox(13, 6, 6, 6, secondaryColor);
                
                // Dome
                headBox(13, 1, 6, 4, gemColor);
                headBox(14, 1, 4, 2, gemHighlight); // Shiny dome
                headDot(14, 1, WHITE); // Specular reflection
                headDot(15, 1, WHITE); // Extra shine
                
                // Eyes & Face details
                headBox(13, 8, 2, 1, WHITE); headBox(17, 8, 2, 1, WHITE); // Sclera
                headDot(14, 8, 0xff0000); headDot(17, 8, 0xff0000); // Red pupils
                
                // Eyeliner / Brow ridge
                headDot(13, 7, BLACK); headDot(14, 7, BLACK); headDot(17, 7, BLACK); headDot(18, 7, BLACK);
                
                // Cheeks (Lines)
                const cheekLine = isTransformed ? DARK_PURPLE_SHADOW : PURPLE_GEM;
                headDot(13, 10, cheekLine); headDot(18, 10, cheekLine);
                
                // Lips
                headBox(15, 11, 2, 1, BLACK);
                
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
                // Right wing
                box(20 + wingSpread, 12, 6, 15, BLACK_S);
                box(21 + wingSpread, 13, 4, 13, 0x223322); // Wing highlight/texture
                
                // Legs (Thighs and Calves)
                box(10, 23, 4, 6, GREEN); box(18, 23, 4, 6, GREEN);
                // Black spots on legs
                dot(11, 24, BLACK_S); dot(13, 26, BLACK_S); dot(10, 27, BLACK_S);
                dot(19, 25, BLACK_S); dot(21, 24, BLACK_S); dot(18, 27, BLACK_S);
                
                // Boots
                box(10, 29, 4, 3, BLACK_S); box(18, 29, 4, 3, BLACK_S); 
                box(10, 31, 4, 2, ORANGE); box(18, 31, 4, 2, ORANGE);
                
                // Torso (Chest and Abdomen)
                // Black upper chest/neck area
                box(11, 14, 10, 4, BLACK_S); 
                // Green abdomen
                box(12, 18, 8, 4, GREEN); 
                // Ribbed texture on abdomen
                box(12, 19, 8, 1, DARK_GREEN); box(12, 21, 8, 1, DARK_GREEN); 
                // Black pelvis area
                box(11, 22, 10, 2, BLACK_S);
                
                // Arms
                // Shoulders
                box(7, 14, 4, 3, GREEN); box(21, 14, 4, 3, GREEN); 
                // Spots on shoulders
                dot(8, 15, BLACK_S); dot(22, 15, BLACK_S);
                
                // Upper arms
                box(8, 17, 3, 5, GREEN); box(21, 17, 3, 5, GREEN); 
                // Spots on arms
                dot(9, 18, BLACK_S); dot(8, 20, BLACK_S);
                dot(22, 19, BLACK_S); dot(23, 17, BLACK_S);
                
                // Lower arms/Hands
                box(8, 21, 3, 2, BLACK_S); box(21, 21, 3, 2, BLACK_S); 
                box(8, 23, 3, 2, PALE); box(21, 23, 3, 2, PALE);
                
                // Head
                // Base face
                headBox(12, 6, 8, 7, GREEN); 
                
                // Crown (Refined shape)
                headBox(11, 0, 2, 8, GREEN); // Left tall prong
                headBox(19, 0, 2, 8, GREEN); // Right tall prong
                headBox(13, 2, 6, 4, GREEN); // Center crown base
                headBox(14, 1, 4, 2, GREEN); // Center crown peak
                
                // Crown spots
                headDot(11, 2, BLACK_S); headDot(12, 5, BLACK_S);
                headDot(20, 3, BLACK_S); headDot(19, 6, BLACK_S);
                headDot(15, 3, BLACK_S); headDot(16, 4, BLACK_S);
                
                // Pale face plate
                headBox(13, 8, 6, 5, PALE); 
                
                // Purple cheek lines
                headBox(12, 9, 1, 3, PURPLE); headBox(19, 9, 1, 3, PURPLE); 
                
                // Eyes
                headBox(13, 9, 2, 1, WHITE); headBox(17, 9, 2, 1, WHITE);
                headDot(14, 9, PINK_EYE); headDot(17, 9, PINK_EYE);
                
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
                
                box(10, 29, 5, 3, METAL_DARK); box(17, 29, 5, 3, METAL_DARK); box(10, 27, 5, 2, METAL_LIGHT); box(17, 27, 5, 2, METAL_LIGHT); box(11, 25, 3, 2, METAL_JOINT); box(18, 25, 3, 2, METAL_JOINT);
                const offY = 6; 
                box(11, 19+offY, 10, 3, METAL_JOINT); box(9, 13+offY, 14, 7, METAL_LIGHT); box(9, 18+offY, 14, 2, METAL_DARK); box(13, 14+offY, 6, 5, METAL_DARK); box(14, 15+offY, 4, 3, ACCENT); 
                box(7, 15+offY, 2, 6, METAL_LIGHT); box(23, 15+offY, 2, 6, METAL_LIGHT); box(7, 21+offY, 2, 2, METAL_DARK); box(23, 21+offY, 2, 2, METAL_DARK);
                const swordY = (f % 2 === 0) ? 14+offY : 15+offY; headBox(6, swordY+6, 2, 4, 0x555555); headBox(5, swordY+5, 4, 1, METAL_DARK); headBox(5, swordY-2, 4, 7, 0xecf0f1); headBox(6, swordY-3, 2, 1, 0xecf0f1); 
                headBox(11, 10+offY, 10, 3, METAL_LIGHT); headBox(11, 6+offY, 10, 4, METAL_LIGHT); headBox(11, 9+offY, 10, 2, 0x000000); headBox(14, 9+offY, 4, 2, EYE); headBox(9, 5+offY, 2, 4, ACCENT); headBox(21, 5+offY, 2, 4, ACCENT); headDot(9, 4+offY, ACCENT); headDot(21, 4+offY, ACCENT);
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
                box(10, 30, 4, 2, SUIT_DARK); box(18, 30, 4, 2, SUIT_DARK); // Boots
                
                // Torso (Armor vest)
                box(11, 14, 10, 10, SUIT_MAIN);
                box(12, 15, 8, 5, SUIT_DARK); // Chest plate
                
                // Arms
                box(8, 14, 3, 5, SUIT_MAIN); box(21, 14, 3, 5, SUIT_MAIN);
                box(8, 19, 3, 4, SKIN_PALE); box(21, 19, 3, 4, SKIN_PALE); // Bare arms/gloves
                box(8, 21, 3, 2, SUIT_DARK); box(21, 21, 3, 2, SUIT_DARK); // Gloves
                
                // Head
                headBox(12, 6, 8, 8, SUIT_MAIN); // Hood
                headBox(13, 8, 6, 3, SKIN_PALE); // Face opening
                headBox(13, 8, 6, 1, VISOR); // Visor eye
                
                // Scarf Animation (Flowing in wind)
                // Base position neck
                headBox(11, 13, 10, 2, SCARF); 
                
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
                
                // Legs
                box(10, 24, 4, 6, GREEN); box(18, 24, 4, 6, GREEN);
                box(10, 27, 4, 2, PAD); box(18, 27, 4, 2, PAD); // Knee pads
                // Torso
                box(11, 14, 10, 10, GREEN);
                box(12, 15, 8, 8, SHELL_FRONT); // Front shell
                box(14, 15, 4, 8, 0xe6b800); // Shell detail
                box(11, 21, 10, 2, BELT); // Belt
                dot(15, 21, 0xaaaaaa); dot(16, 21, 0xaaaaaa); // Belt buckle
                // Arms
                box(8, 14, 3, 8, GREEN); box(21, 14, 3, 8, GREEN);
                box(8, 18, 3, 2, PAD); box(21, 18, 3, 2, PAD); // Elbow pads
                box(8, 21, 3, 2, PAD); box(21, 21, 3, 2, PAD); // Wrist wraps
                // Katanas on back
                box(9, 12, 2, 10, STEEL); box(21, 12, 2, 10, STEEL); // Blades crossing
                // Head
                headBox(12, 6, 8, 8, GREEN);
                headBox(11, 9, 10, 2, BANDANA); // Bandana
                headBox(10, 10, 2, 4, BANDANA); // Bandana knot tail
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
                
                // Legs
                box(12, 24, 3, 6, TIGHTS); box(17, 24, 3, 6, TIGHTS);
                box(11, 28, 4, 3, BOOTS); box(17, 28, 4, 3, BOOTS);
                // Torso
                box(11, 14, 10, 10, COAT);
                box(11, 14, 10, 3, SCARF); // Collar
                box(15, 14, 2, 10, GOLD); // Center trim
                box(11, 22, 10, 2, 0x222222); // Belt
                // Arms
                box(8, 14, 3, 8, COAT); box(21, 14, 3, 8, COAT);
                box(8, 20, 3, 2, TIGHTS); box(21, 20, 3, 2, TIGHTS); // Gloves/cuffs
                // Staff
                box(23, 10, 2, 20, 0x8b4513); // Staff pole
                box(22, 8, 4, 3, GOLD); // Staff top
                dot(23, 7, 0xe74c3c); // Red gem
                // Head
                headBox(12, 6, 8, 8, SKIN);
                headBox(11, 4, 10, 4, HAIR); // Hair top
                headBox(13, 4, 6, 1, HAIR_SHADOW);
                // Twintails
                headBox(9, 6, 3, 12, HAIR); headBox(20, 6, 3, 12, HAIR); 
                headBox(10, 18, 2, 2, 0xcc0000); headBox(20, 18, 2, 2, 0xcc0000); // Red hair ties
                // Elf Ears
                headBox(8, 9, 4, 2, SKIN); headBox(20, 9, 4, 2, SKIN);
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
                    box(11, 24, 3, 7, BLUE_SHADOW); box(18, 24, 3, 7, BLUE_SHADOW); // Leg shading
                    box(11, 22, 3, 3, SILVER); box(18, 22, 3, 3, SILVER); // Thighs
                    box(10, 30, 5, 2, BLUE_SHADOW); box(17, 30, 5, 2, BLUE_SHADOW); // Feet
                    
                    // Torso (Red cab)
                    box(9, 12, 14, 10, RED);
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
                    box(11, 21, 2, 2, YELLOW); box(19, 21, 2, 2, YELLOW); // Headlights
                    
                    // Arms
                    box(5, 12, 4, 8, RED); box(23, 12, 4, 8, RED);
                    box(4, 11, 6, 4, RED_SHADOW); box(22, 11, 6, 4, RED_SHADOW); // Shoulders
                    box(5, 18, 4, 5, BLUE); box(23, 18, 4, 5, BLUE); // Forearms
                    box(6, 18, 2, 5, BLUE_SHADOW); box(24, 18, 2, 5, BLUE_SHADOW); // Forearm shading
                    box(5, 22, 4, 2, BLUE_SHADOW); box(23, 22, 4, 2, BLUE_SHADOW); // Hands
                    
                    // Smokestacks (Shoulders)
                    box(4, 5, 2, 7, SILVER); box(26, 5, 2, 7, SILVER);
                    
                    // Head
                    headBox(13, 5, 6, 7, BLUE);
                    headBox(14, 5, 4, 2, SILVER); // Crest
                    headBox(12, 6, 1, 4, BLUE); headBox(19, 6, 1, 4, BLUE); // Antennae
                    headBox(14, 8, 4, 4, SILVER); // Faceplate
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
                    // Kurama Link Mode / Six Paths Aura
                    canvas.fillStyle(K_ORANGE, 0.4);
                    canvas.fillRect((offsetX + 4) * SCALE, (breatheOffset - 10 + DRAW_OFFSET_Y) * SCALE, 24 * SCALE, 42 * SCALE);
                    canvas.fillStyle(K_YELLOW, 0.6);
                    canvas.fillRect((offsetX + 6) * SCALE, (breatheOffset - 6 + DRAW_OFFSET_Y) * SCALE, 20 * SCALE, 38 * SCALE);
                    
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
                const SAGE_ORANGE = 0xff4400;
                
                // Scroll on back (drawn before torso so it's behind)
                if (isSageMode) {
                    box(8, 15, 16, 8, 0xdddddd); // Scroll base
                    box(7, 16, 18, 6, 0x880000); // Scroll ends
                    box(10, 15, 12, 8, 0xeeeeee); // Scroll inner
                }

                // Legs
                box(10, 24, 4, 6, suitColor); box(18, 24, 4, 6, suitColor);
                // Shoes/Sandals
                box(10, 30, 4, 2, detailColor); box(18, 30, 4, 2, detailColor);
                if (!isKuramaMode) {
                    // Bandages on right leg
                    box(10, 26, 4, 2, 0xeeeeee);
                    // Holster on right leg
                    box(13, 25, 2, 3, BLACK);
                }
                
                // Torso
                box(11, 14, 10, 10, suitColor);
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
                    // Orange collar
                    box(11, 13, 10, 2, ORANGE);
                    // White swirl on left arm
                    box(21, 16, 2, 2, 0xeeeeee);
                    
                    if (isSageMode) {
                        // Red Coat (Open in the front)
                        // Left side
                        box(9, 14, 4, 12, RED_COAT);
                        box(9, 24, 4, 2, BLACK); // Flames
                        // Right side
                        box(19, 14, 4, 12, RED_COAT);
                        box(19, 24, 4, 2, BLACK); // Flames
                    }
                }
                
                // Arms
                if (isSageMode) {
                    box(6, 14, 4, 6, RED_COAT); box(22, 14, 4, 6, RED_COAT); // Coat sleeves
                    box(7, 20, 3, 3, skinColor); box(22, 20, 3, 3, skinColor); // Hands
                } else {
                    box(8, 14, 3, 6, suitColor); box(21, 14, 3, 6, suitColor);
                    box(8, 20, 3, 3, skinColor); box(21, 20, 3, 3, skinColor); // Hands
                }
                
                // Head
                headBox(12, 6, 8, 7, skinColor);
                
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
                
                // Legs (Red tights, yellow shorts, yellow shoes)
                box(11, 24, 4, 6, RED); box(17, 24, 4, 6, RED);
                box(10, 22, 12, 4, YELLOW); // Shorts
                box(11, 28, 4, 3, YELLOW); box(17, 28, 4, 3, YELLOW); // Shoes
                box(11, 30, 4, 1, BLACK); box(17, 30, 4, 1, BLACK); // Soles
                
                // Torso (Red suit with yellow heart)
                box(10, 14, 12, 10, RED);
                box(11, 14, 10, 10, RED_SHADOW);
                // Yellow Heart (approximate)
                box(13, 16, 6, 5, YELLOW);
                box(12, 16, 8, 2, YELLOW);
                box(14, 21, 4, 1, YELLOW);
                // "CH" in red (just two dots for scale)
                dot(14, 17, RED); dot(17, 17, RED);
                
                // Arms (Red sleeves, skin hands)
                box(7, 14, 3, 7, RED); box(22, 14, 3, 7, RED);
                box(7, 21, 3, 2, SKIN); box(22, 21, 3, 2, SKIN); // Hands
                
                // Head (Red hood, skin face)
                headBox(11, 5, 10, 9, RED); // Hood
                headBox(12, 7, 8, 6, SKIN); // Face
                headDot(14, 9, BLACK); headDot(17, 9, BLACK); // Eyes
                
                // Antennas (Vinil)
                headBox(12, 2, 1, 4, RED); headBox(19, 2, 1, 4, RED);
                headBox(11, 1, 3, 2, YELLOW); headBox(18, 1, 3, 2, YELLOW); // Tips
                
                // Chipote Chillón (Mallet) in hand (frame 0 and 2 slightly different)
                const malletY = (f % 2 === 0) ? 14 : 15;
                // Handle
                box(23, malletY - 2, 2, 12, YELLOW);
                // Head (Red with yellow sides)
                box(21, malletY - 6, 6, 8, RED);
                box(20, malletY - 4, 8, 4, YELLOW);
                break;
            }
            case 'batman': {
                const isArmored = form === 1;
                const SUIT_GREY = isArmored ? 0x2c3e50 : 0x34495e;
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
                // Boots
                box(10, 28, 5, 4, BLACK); box(17, 28, 5, 4, BLACK);
                if (isArmored) {
                    // Armor plates on legs
                    box(11, 25, 4, 2, 0x7f8c8d); box(17, 25, 4, 2, 0x7f8c8d);
                }

                // Torso
                box(10, 14, 12, 10, SUIT_GREY);
                // Bat Symbol
                box(13, 16, 6, 3, BLACK);
                dot(12, 16, BLACK); dot(19, 16, BLACK); // Wings
                dot(15, 15, BLACK); dot(16, 15, BLACK); // Ears of the bat
                
                // Utility Belt
                box(10, 22, 12, 2, YELLOW);
                box(11, 22, 2, 2, 0xd4ac0d); // Pouches
                box(15, 22, 2, 2, 0xd4ac0d);
                box(19, 22, 2, 2, 0xd4ac0d);

                // Arms
                box(7, 14, 3, 7, SUIT_GREY); box(22, 14, 3, 7, SUIT_GREY);
                // Gauntlets
                box(6, 18, 4, 5, BLACK); box(22, 18, 4, 5, BLACK);
                // Fins on gauntlets
                dot(5, 19, BLACK); dot(5, 21, BLACK);
                dot(26, 19, BLACK); dot(26, 21, BLACK);

                // Head (Cowl)
                headBox(11, 5, 10, 9, BLACK);
                if (isArmored) {
                   headBox(12, 7, 8, 6, 0x34495e); // Metal faceplate
                   headBox(13, 9, 2, 1, ARMOR_GLOW); headBox(17, 9, 2, 1, ARMOR_GLOW); // Glowing eyes
                } else {
                   headBox(12, 8, 8, 5, SKIN); // Face opening
                   headBox(13, 9, 2, 1, 0xffffff); headBox(17, 9, 2, 1, 0xffffff); // White eyes
                   headBox(12, 11, 8, 2, SKIN); // Chin
                }
                
                // Bat Ears
                headBox(11, 2, 2, 4, BLACK); headBox(19, 2, 2, 4, BLACK);
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
