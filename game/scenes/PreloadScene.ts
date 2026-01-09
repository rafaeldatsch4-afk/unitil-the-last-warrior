
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
  }

  create() {
    this.createAudioAssets();
    this.createFXAssets();

    // Load Characters
    const currentState = window.UTLW?.state;
    const chars = currentState && currentState.characters ? currentState.characters : INITIAL_CHARACTERS;

    chars.forEach(c => {
      // Base Form
      if (this.textures.exists(c.key)) this.textures.remove(c.key);
      this.generateLSWSprite(c.key, false);
      
      // Transformation
      if(c.transformAvailable) {
        const keySSJ = `${c.key}_ssj`;
        if (this.textures.exists(keySSJ)) this.textures.remove(keySSJ);
        this.generateLSWSprite(c.key, true);
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
  generateLSWSprite(key: string, isTransformed: boolean) {
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
                
                // NEW GOLDEN SSJ PALETTE (REMASTERED)
                const HAIR_SSJ_GOLD = 0xffd93b; 
                const HAIR_SSJ_SHADOW = 0xcfa721;
                const HAIR_SSJ_LIGHT = 0xffffaa;
                const EYE_SSJ_TEAL = 0x00f2ff;

                const hairColor = isTransformed ? HAIR_SSJ_GOLD : HAIR_BLACK;
                const eyeColor = isTransformed ? EYE_SSJ_TEAL : 0x111111;
                const eyebrowColor = isTransformed ? HAIR_SSJ_SHADOW : HAIR_BLACK;

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

                if (!isTransformed) {
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
                if (!isTransformed) {
                    // BASE GOKU (Palm Tree)
                    headBox(11, 2, 10, 6, hairColor); // Main Volume
                    headBox(14, 0, 4, 2, hairColor); // Top bump
                    
                    // Spikes Left (Curved)
                    headBox(9, 3, 2, 4, hairColor); headDot(8, 5, hairColor);
                    headBox(7, 4, 2, 3, hairColor);
                    
                    // Spikes Right
                    headBox(21, 3, 2, 3, hairColor); headDot(23, 5, hairColor);
                    
                    // Bangs (Base)
                    headBox(13, 6, 2, 2, hairColor);
                    headBox(16, 6, 3, 2, hairColor);
                } else {
                    // === GOKU SSJ REMASTERED (v5 - The "Swept Back" Look) ===
                    // Design: Main hair mass sweeps strongly UP and BACK (Left).
                    
                    // 1. Base Volume
                    headBox(10, -2, 12, 8, hairColor);

                    // 2. The Big Sweep (Going Back/Left and Up)
                    headBox(6, -6, 10, 10, hairColor); 
                    headBox(4, -12, 8, 8, hairColor); 
                    headBox(2, -18, 6, 8, hairColor); // Tip far back-left
                    headDot(2, -19, HAIR_SSJ_LIGHT);

                    // 3. Central/Top Spikes (Vertical but angled)
                    headBox(14, -10, 6, 10, hairColor);
                    headBox(16, -16, 4, 8, hairColor);
                    headDot(18, -17, HAIR_SSJ_LIGHT);

                    // 4. Front Spikes (Bangs standing up/forward)
                    headBox(20, -4, 4, 8, hairColor);
                    headBox(22, 0, 2, 4, hairColor);

                    // 5. Forehead Bang (Classic LSW style)
                    headBox(16, 4, 3, 5, hairColor);
                    headDot(17, 8, HAIR_SSJ_LIGHT);

                    // 6. Shading for depth (Roots and underside)
                    headBox(11, 0, 10, 2, HAIR_SSJ_SHADOW); 
                    headDot(15, -4, HAIR_SSJ_SHADOW);
                    headDot(7, -4, HAIR_SSJ_SHADOW);
                }
                break;
            }
            case 'vegeta': {
                const SUIT_BLUE = 0x1a2a6c; const SUIT_SHADOW = 0x111b44; const ARMOR_WHITE = 0xfbfbfb; const ARMOR_SHADOW = 0xd0d0d0; const GOLD = 0xffd700;
                const HAIR = isTransformed ? 0xffe14c : BLACK; const EYE = isTransformed ? 0x00e5bb : BLACK; const BROW = isTransformed ? 0xffe14c : BLACK;
                box(10, 23, 4, 7, SUIT_BLUE); box(18, 23, 4, 7, SUIT_BLUE);
                box(10, 29, 4, 3, ARMOR_WHITE); box(18, 29, 4, 3, ARMOR_WHITE); box(10, 31, 4, 1, GOLD); box(18, 31, 4, 1, GOLD); box(11, 29, 2, 3, ARMOR_SHADOW); box(19, 29, 2, 3, ARMOR_SHADOW);
                box(11, 19, 10, 5, SUIT_BLUE); dot(15, 19, SUIT_SHADOW); dot(16, 19, SUIT_SHADOW); dot(13, 20, SUIT_SHADOW); dot(18, 20, SUIT_SHADOW);
                box(10, 14, 12, 5, ARMOR_WHITE); box(10, 17, 12, 1, ARMOR_SHADOW); box(11, 14, 3, 5, GOLD); box(18, 14, 3, 5, GOLD); 
                box(5, 14, 5, 2, GOLD); box(5, 16, 5, 3, ARMOR_WHITE); box(22, 14, 5, 2, GOLD); box(22, 16, 5, 3, ARMOR_WHITE);
                box(8, 15, 3, 5, SUIT_BLUE); box(21, 15, 3, 5, SUIT_BLUE); box(8, 20, 3, 4, ARMOR_WHITE); box(21, 20, 3, 4, ARMOR_WHITE); box(8, 19, 3, 1, ARMOR_SHADOW); box(21, 19, 3, 1, ARMOR_SHADOW);
                headBox(12, 6, 8, 7, SKIN); headDot(12, 6, HAIR); headDot(13, 7, HAIR); headDot(19, 6, HAIR); headDot(18, 7, HAIR);
                headDot(13, 9, WHITE); headDot(17, 9, WHITE); headDot(14, 9, EYE); headDot(17, 9, EYE); headDot(13, 8, BROW); headDot(14, 8, BROW); headDot(17, 8, BROW); headDot(18, 8, BROW);
                canvas.fillStyle(HAIR, 1); headBox(13, 0, 6, 6, HAIR); headBox(11, 2, 2, 4, HAIR); headBox(19, 2, 2, 4, HAIR); headBox(12, 5, 8, 2, HAIR);
                if(isTransformed) { headDot(14, -1, HAIR); headDot(17, -1, HAIR); headDot(10, 3, HAIR); headDot(21, 3, HAIR); }
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
                const GI_PURPLE = 0x2e1a47; const GI_SHADOW = 0x1d0f2e; const SASH_RED = 0xd92525; const SHOE_BROWN = 0x6d4c41; const HAIR_BASE = BLACK; const HAIR_BEAST = 0xddeeff; const EYE_BEAST = 0xff0000;
                const hairColor = isTransformed ? HAIR_BEAST : HAIR_BASE; const eyeColor = isTransformed ? EYE_BEAST : BLACK;
                box(10, 23, 4, 7, GI_PURPLE); box(18, 23, 4, 7, GI_PURPLE); box(10, 30, 4, 2, SHOE_BROWN); box(18, 30, 4, 2, SHOE_BROWN);
                box(11, 14, 10, 9, GI_PURPLE); box(12, 16, 8, 3, GI_SHADOW); box(11, 22, 10, 3, SASH_RED); box(8, 19, 3, 3, GI_PURPLE); box(21, 19, 3, 3, GI_PURPLE); box(8, 15, 3, 4, SKIN); box(21, 15, 3, 4, SKIN); box(8, 22, 3, 2, SKIN); box(21, 22, 3, 2, SKIN);
                headBox(12, 6, 8, 7, SKIN); headDot(13, 9, WHITE); headDot(17, 9, WHITE); headDot(14, 9, eyeColor); headDot(17, 9, eyeColor); headDot(15, 11, 0xcc8866);
                canvas.fillStyle(hairColor, 1);
                if (isTransformed) { headBox(12, -12, 8, 18, hairColor); headBox(10, -5, 2, 10, hairColor); headBox(20, -5, 2, 10, hairColor); headBox(8, -2, 3, 6, hairColor); headBox(21, -2, 3, 6, hairColor); headBox(15, 6, 2, 6, hairColor); headDot(14, 9, 0xff0000); headDot(17, 9, 0xff0000); } else { headBox(12, 2, 8, 4, hairColor); headBox(13, 0, 2, 3, hairColor); headBox(17, 0, 2, 3, hairColor); headBox(15, -1, 2, 4, hairColor); headDot(16, 6, hairColor); }
                break;
            }
            case 'frieza': {
                const WHITE_SKIN = 0xffffff; const WHITE_SHADOW = 0xd0d0e0; const PURPLE_GEM = 0x660099; const PURPLE_SHADOW = 0x330055; const PURPLE_HIGHLIGHT = 0xaa44dd; const GOLD_SKIN = 0xffd700; const GOLD_SHADOW = 0xc5a000; const DARK_SKIN = 0x5d4037;
                const mainColor = isTransformed ? GOLD_SKIN : WHITE_SKIN; const shadowColor = isTransformed ? GOLD_SHADOW : WHITE_SHADOW; const gemColor = isTransformed ? GOLD_SKIN : PURPLE_GEM; const gemShadow = isTransformed ? GOLD_SHADOW : PURPLE_SHADOW; const secondaryColor = isTransformed ? DARK_SKIN : WHITE_SKIN; 
                const tailY = (f % 2 === 0) ? 22 : 23;
                box(14, tailY, 6, 4, mainColor); box(19, tailY-4, 4, 5, mainColor); box(20, tailY-8, 3, 5, mainColor); box(18, tailY-12, 4, 4, mainColor); if(!isTransformed) { box(18, tailY-12, 2, 2, 0xffcccc); }
                box(11, 23, 4, 5, mainColor); box(17, 23, 4, 5, mainColor); box(11, 23, 1, 5, shadowColor); box(20, 23, 1, 5, shadowColor); box(11, 28, 4, 1, shadowColor); box(17, 28, 4, 1, shadowColor);
                if(!isTransformed) { box(11, 29, 4, 3, PURPLE_GEM); box(17, 29, 4, 3, PURPLE_GEM); dot(12, 30, PURPLE_HIGHLIGHT); dot(18, 30, PURPLE_HIGHLIGHT); box(11, 29, 1, 3, PURPLE_SHADOW); box(17, 29, 1, 3, PURPLE_SHADOW); } else { box(11, 29, 4, 3, mainColor); box(17, 29, 4, 3, mainColor); }
                box(10, 32, 2, 2, secondaryColor); box(12, 32, 2, 2, secondaryColor); box(14, 32, 2, 2, secondaryColor); box(16, 32, 2, 2, secondaryColor); box(18, 32, 2, 2, secondaryColor); box(20, 32, 2, 2, secondaryColor);
                box(11, 14, 10, 9, mainColor); box(12, 19, 8, 1, shadowColor); box(12, 21, 8, 1, shadowColor);
                if(!isTransformed) { box(13, 15, 6, 3, PURPLE_GEM); dot(14, 15, PURPLE_HIGHLIGHT); dot(15, 16, PURPLE_HIGHLIGHT); box(13, 17, 6, 1, PURPLE_SHADOW); } else { box(13, 15, 6, 3, mainColor); }
                box(8, 14, 4, 4, mainColor); if(!isTransformed) box(9, 15, 2, 2, PURPLE_GEM); box(20, 14, 4, 4, mainColor); if(!isTransformed) box(21, 15, 2, 2, PURPLE_GEM);
                box(8, 18, 3, 5, mainColor); box(21, 18, 3, 5, mainColor); if(!isTransformed) { box(8, 21, 3, 2, PURPLE_GEM); box(21, 21, 3, 2, PURPLE_GEM); } else { box(8, 21, 3, 2, mainColor); box(21, 21, 3, 2, mainColor); } box(8, 23, 3, 3, secondaryColor); box(21, 23, 3, 3, secondaryColor);
                headBox(12, 6, 8, 7, secondaryColor); if(!isTransformed) { headBox(13, 6, 6, 3, PURPLE_GEM); headDot(14, 6, PURPLE_HIGHLIGHT); headDot(16, 7, PURPLE_HIGHLIGHT); } else { headBox(13, 6, 6, 3, mainColor); }
                const cheekColor = isTransformed ? 0x3e2723 : 0xaa88aa; headDot(13, 10, cheekColor); headDot(18, 10, cheekColor); headDot(13, 9, 0xff0000); headDot(14, 9, 0xff0000); headDot(17, 9, 0xff0000); headDot(18, 9, 0xff0000); headDot(13, 8, BLACK); headDot(14, 8, BLACK); headDot(17, 8, BLACK); headDot(18, 8, BLACK); const lipColor = 0x663366; headDot(15, 12, lipColor); headDot(16, 12, lipColor);
                break;
            }
            case 'cell': {
                const GREEN = 0x66bb66; const BLACK_S = 0x112211; const PALE = 0xeeeeee; const ORANGE = 0xffaa00;
                const wingW = (f===1 || f===3) ? 5 : 4; 
                headBox(6, 10, wingW, 14, BLACK_S); headBox(22 + (4-wingW), 10, wingW, 14, BLACK_S);
                box(10, 23, 4, 6, GREEN); box(18, 23, 4, 6, GREEN); dot(11, 24, BLACK_S); dot(19, 25, BLACK_S); box(10, 29, 4, 3, BLACK_S); box(18, 29, 4, 3, BLACK_S); box(10, 31, 4, 2, ORANGE); box(18, 31, 4, 2, ORANGE);
                box(11, 14, 10, 4, BLACK_S); box(12, 18, 8, 4, GREEN); box(12, 19, 8, 1, 0x448844); box(12, 21, 8, 1, 0x448844); box(11, 22, 10, 2, BLACK_S);
                box(7, 14, 4, 3, GREEN); box(21, 14, 4, 3, GREEN); box(8, 17, 3, 5, GREEN); box(21, 17, 3, 5, GREEN); dot(9, 18, BLACK_S); dot(22, 19, BLACK_S); box(8, 21, 3, 2, BLACK_S); box(21, 21, 3, 2, BLACK_S); box(8, 23, 3, 2, PALE); box(21, 23, 3, 2, PALE);
                headBox(12, 6, 8, 7, GREEN); headBox(11, 2, 2, 7, GREEN); headBox(19, 2, 2, 7, GREEN); headBox(13, 3, 6, 3, GREEN); headBox(13, 9, 6, 4, PALE); headBox(12, 9, 1, 3, 0xaa44cc); headBox(19, 9, 1, 3, 0xaa44cc); headDot(14, 10, 0xff00cc); headDot(17, 10, 0xff00cc);
                break;
            }
            case 'leonardo': {
                const TURTLE_GREEN = 0x2e8b57; const SHELL_DARK = 0x1a4d2e; const PLASTRON_YELLOW = 0xf4d03f; const MASK_BLUE = 0x3498db; const PAD_BROWN = 0x6e2c00; const STRAP_BROWN = 0x5d4037; const METAL_GREY = 0xbdc3c7;
                box(8, 12, 16, 14, SHELL_DARK); box(10, 23, 4, 5, TURTLE_GREEN); box(18, 23, 4, 5, TURTLE_GREEN); box(9, 26, 6, 3, PAD_BROWN); box(17, 26, 6, 3, PAD_BROWN); box(10, 29, 4, 3, TURTLE_GREEN); box(18, 29, 4, 3, TURTLE_GREEN); box(10, 31, 2, 2, TURTLE_GREEN); box(12, 31, 2, 2, TURTLE_GREEN); box(18, 31, 2, 2, TURTLE_GREEN); box(20, 31, 2, 2, TURTLE_GREEN);
                box(10, 13, 12, 10, TURTLE_GREEN); box(11, 14, 10, 9, PLASTRON_YELLOW); box(11, 17, 10, 1, 0xd4ac0d); box(11, 20, 10, 1, 0xd4ac0d); box(15, 14, 1, 9, 0xd4ac0d); box(10, 22, 12, 3, PAD_BROWN); box(14, 22, 4, 3, METAL_GREY); dot(15, 22, MASK_BLUE); dot(15, 23, MASK_BLUE); dot(16, 23, MASK_BLUE); dot(11, 13, STRAP_BROWN); dot(20, 13, STRAP_BROWN); dot(12, 14, STRAP_BROWN); dot(19, 14, STRAP_BROWN);
                box(7, 14, 4, 4, TURTLE_GREEN); box(21, 14, 4, 4, TURTLE_GREEN); box(7, 17, 4, 2, PAD_BROWN); box(21, 17, 4, 2, PAD_BROWN); box(8, 19, 3, 3, TURTLE_GREEN); box(21, 19, 3, 3, TURTLE_GREEN); box(8, 21, 3, 2, PAD_BROWN); box(21, 21, 3, 2, PAD_BROWN); box(8, 23, 3, 3, TURTLE_GREEN); box(21, 23, 3, 3, TURTLE_GREEN);
                const kY = (f % 2 === 0) ? 6 : 7; headBox(6, kY, 2, 8, BLACK); headBox(6, kY-1, 2, 1, METAL_GREY); headBox(24, kY, 2, 8, BLACK); headBox(24, kY-1, 2, 1, METAL_GREY);
                headBox(12, 5, 8, 8, TURTLE_GREEN); headBox(13, 10, 6, 3, 0x27ae60); headDot(16, 11, BLACK); headDot(17, 11, BLACK); headBox(11, 7, 10, 3, MASK_BLUE); headDot(12, 8, WHITE); headDot(13, 8, WHITE); headDot(18, 8, WHITE); headDot(19, 8, WHITE); 
                const tailX = (f % 2 === 0) ? 20 : 21; headBox(tailX, 7, 2, 2, MASK_BLUE); headDot(tailX+2, 7, MASK_BLUE); headDot(tailX+3, 6, MASK_BLUE); headDot(tailX+2, 9, MASK_BLUE); headDot(tailX+3, 10, MASK_BLUE);
                break;
            }
            case 'frieren': {
                const DRESS_WHITE = 0xfcfcfc; const GOLD = 0xddbb00; const HAIR = 0xe8e8e8; const STAFF_BROWN = 0x5d4037; const STAFF_RED = 0xcc0000; const COLLAR_BLACK = 0x222222; const WAIST_BROWN = 0x3e2723;
                const skirtW = (f % 2 === 0) ? 14 : 15;
                box(9, 23, skirtW, 9, DRESS_WHITE); box(12, 23, 1, 9, GOLD); box(19, 23, 1, 9, GOLD); box(9, 30, 14, 2, GOLD); box(10, 29, 4, 3, COLLAR_BLACK); box(18, 29, 4, 3, COLLAR_BLACK);
                box(11, 14, 10, 9, DRESS_WHITE); box(13, 13, 6, 3, COLLAR_BLACK); box(14, 16, 1, 6, GOLD); box(17, 16, 1, 6, GOLD); box(11, 22, 10, 1, WAIST_BROWN); box(9, 14, 14, 3, DRESS_WHITE); box(9, 17, 14, 1, GOLD);
                box(7, 16, 4, 6, DRESS_WHITE); box(21, 16, 4, 6, DRESS_WHITE); dot(8, 22, SKIN); dot(21, 22, SKIN);
                headBox(12, 6, 8, 7, SKIN); headDot(11, 8, SKIN); headDot(10, 7, SKIN); headDot(20, 8, SKIN); headDot(21, 7, SKIN); headDot(10, 9, 0xff0000); headDot(21, 9, 0xff0000); headDot(13, 9, 0x2ecc71); headDot(14, 9, 0x2ecc71); headDot(17, 9, 0x2ecc71); headDot(18, 9, 0x2ecc71); headDot(16, 11, 0xcc8866);
                canvas.fillStyle(HAIR, 1); headBox(11, 5, 10, 3, HAIR); headBox(12, 7, 8, 2, HAIR); headBox(8, 8, 3, 12, HAIR); headBox(21, 8, 3, 12, HAIR); headDot(9, 20, HAIR); headDot(22, 20, HAIR);
                const sY = (f % 2 === 0) ? 4 : 5; const sx = 24; box(sx, sY, 2, 28, STAFF_BROWN); box(sx-4, sY-2, 10, 2, GOLD); box(sx-5, sY-2, 2, 6, GOLD); box(sx+5, sY-2, 2, 6, GOLD); box(sx-3, sY+4, 8, 1, GOLD); box(sx-1, sY, 4, 4, STAFF_RED);
                break;
            }
            case 'optimus': {
                const MOVIE_RED = 0xa81d1d; const MOVIE_BLUE = 0x0a2647; const CHROME = 0xbdc3c7; const MECHANICS = 0x4a5568; const FLAME = 0xf39c12; const GLASS = 0x3498db; const EYES = 0x00ffff;
                if (isTransformed) {
                    const vib = (f % 2); 
                    box(4, 24, 4, 4, BLACK); box(5, 25, 2, 2, CHROME); box(10, 24, 4, 4, BLACK); box(11, 25, 2, 2, CHROME); box(4, 22+vib, 20, 2, MECHANICS); box(4, 12+vib, 8, 10, MOVIE_BLUE); box(12, 12+vib, 6, 10, MOVIE_RED); box(18, 16+vib, 10, 6, MOVIE_RED); dot(20, 18+vib, FLAME); dot(21, 18+vib, FLAME); dot(22, 19+vib, FLAME); dot(23, 19+vib, FLAME); dot(24, 20+vib, FLAME); dot(25, 20+vib, FLAME); box(13, 13+vib, 4, 3, GLASS); box(28, 16+vib, 2, 6, CHROME); box(22, 24, 4, 4, BLACK); box(23, 25, 2, 2, CHROME); box(10, 4+vib, 2, 10, CHROME);
                } else {
                    box(11, 23, 3, 4, MECHANICS); box(18, 23, 3, 4, MECHANICS); box(10, 24, 1, 3, MOVIE_BLUE); box(21, 24, 1, 3, MOVIE_BLUE); box(10, 26, 4, 2, CHROME); box(18, 26, 4, 2, CHROME); box(10, 28, 4, 4, MOVIE_BLUE); box(18, 28, 4, 4, MOVIE_BLUE); dot(11, 28, FLAME); dot(19, 28, FLAME); box(10, 32, 2, 2, CHROME); box(12, 32, 2, 2, MOVIE_BLUE); box(18, 32, 2, 2, MOVIE_BLUE); box(20, 32, 2, 2, CHROME); box(10, 14, 12, 9, MECHANICS); box(13, 19, 6, 4, CHROME);
                    headBox(10, 14, 5, 4, MOVIE_RED); headDot(11, 15, GLASS); headDot(12, 15, GLASS); headBox(17, 14, 5, 4, MOVIE_RED); headDot(19, 15, GLASS); headDot(20, 15, GLASS); headDot(11, 17, FLAME); headDot(18, 17, FLAME); headBox(7, 13, 4, 4, MOVIE_RED); headBox(21, 13, 4, 4, MOVIE_RED); headDot(8, 15, FLAME); headDot(22, 15, FLAME); headBox(6, 9, 2, 6, CHROME); headBox(24, 9, 2, 6, CHROME); headBox(8, 17, 3, 3, MECHANICS); headBox(21, 17, 3, 3, MECHANICS); headBox(7, 20, 4, 3, MOVIE_RED); headBox(21, 20, 4, 3, MOVIE_RED); headBox(7, 23, 3, 2, MOVIE_BLUE); headBox(22, 23, 3, 2, MOVIE_BLUE); headBox(13, 6, 6, 7, MOVIE_BLUE); headBox(14, 10, 4, 3, CHROME); headDot(14, 8, EYES); headDot(17, 8, EYES); headDot(15, 6, CHROME); headDot(16, 6, CHROME); headBox(12, 5, 1, 3, MOVIE_BLUE); headBox(19, 5, 1, 3, MOVIE_BLUE); 
                }
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
        }
    } // End Loop

    const textureName = isTransformed ? `${key}_ssj` : key;
    canvas.generateTexture(textureName, sheetWidth, sheetHeight);
    
    // Manually add frame data to the new texture so Phaser knows it's a spritesheet
    if (this.textures.exists(textureName)) {
        const tex = this.textures.get(textureName);
        const fw = FRAME_WIDTH * SCALE;
        const fh = FRAME_HEIGHT * SCALE;
        for(let i=0; i<FRAMES; i++) {
            tex.add(i, 0, i * fw, 0, fw, fh);
        }
    }
    
    canvas.destroy();
  }
}
