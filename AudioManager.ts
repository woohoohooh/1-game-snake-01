
class AudioManager {
  private musicList: string[] = Array.from({ length: 10 }, (_, i) => `music/${i + 1}.wav`);
  private playedMusic: string[] = [];
  private currentMusic: HTMLAudioElement | null = null;
  private sfxApple: HTMLAudioElement = new Audio('sound/apple.wav');
  private sfxEnd: HTMLAudioElement = new Audio('sound/end.wav');

  constructor() {
    this.sfxApple.load();
    this.sfxEnd.load();
  }

  playNextTrack() {
    if (this.musicList.length === 0) {
      this.musicList = [...this.playedMusic];
      this.playedMusic = [];
    }

    const randomIndex = Math.floor(Math.random() * this.musicList.length);
    const trackPath = this.musicList.splice(randomIndex, 1)[0];
    this.playedMusic.push(trackPath);

    if (this.currentMusic) {
      this.currentMusic.pause();
    }

    this.currentMusic = new Audio(trackPath);
    this.currentMusic.play().catch(e => console.log("User interaction needed for audio"));
    this.currentMusic.onended = () => this.playNextTrack();
  }

  playApple() {
    this.sfxApple.currentTime = 0;
    this.sfxApple.play().catch(() => {});
  }

  playEnd() {
    this.sfxEnd.currentTime = 0;
    this.sfxEnd.play().catch(() => {});
  }
}

export const audioManager = new AudioManager();
