import { createAudioResource, StreamType } from "@discordjs/voice";
import * as prism from "prism-media";
import Player from "./Player";
export default class FilterManager {
  filters: object;
  player: Player;
  args: string[];
  constructor(player: Player) {
    this.filters = {};
    this.player = player;
    this.args = [
      "-analyzeduration",
      "0",
      "-loglevel",
      "0",
      "-preset",
      "veryfast",
      "-f",
      "s16le",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-vn",
    ];
  }
  /**
   * @method addFilters
   * @param  {any[]} ...filters
   * @returns void
   */
  public async addFilters(filters: object) {
    for (const [filter, data] of Object.entries(filters)) {
      this.filters[filter] = data;
    }
    return await this._applyFilters();
  }
  /**
   * @method removeFilters
   * @param  {any[]} ...filters
   * @returns void
   */
  public removeFilters(...filters: any[]): void {
    for (const filter of filters) {
      delete this.filters[filter];
    }
  }

  public async setFilters(filters: object) {
    this.filters = filters;
    return await this._applyFilters();
  }

  public async resetFilters() {
    this.filters = {};
    return await this._applyFilters();
  }
  public async _applyFilters() {
    const args = [...this.args];
    const filters = Object.entries(this.filters)
      .map((x) => `${x[0]}=${x[1]}`)
      .join(",");
    if (filters.length > 0) {
      args.push("-af");
      args.push(filters);
    }
    if (this.player.options.seekWhenFilter) {
      const duration =
        this.player.requestManager.currentStream.playbackDuration;
      args.push("-ss", Math.trunc(duration / 1000).toString());
    }
    const ffmpeg = new prism.FFmpeg({
      args,
    });

    const opus = new prism.opus.Encoder({
      rate: 48000,
      channels: 2,
      frameSize: 960,
    });
    const fdata = (await this.player.requestManager.getStream()).pipe(ffmpeg);

    const resource = createAudioResource(fdata.pipe(opus), {
      inlineVolume: true,
      inputType: StreamType.Opus,
    });

    this.player.requestManager.currentStream = resource;
    this.player.play();
    return this.filters;
  }

  async seekTo(time: number) {
    const args = [...this.args];
    args.push("-ss", `${time}`);
    const filters = Object.entries(this.filters)
      .map((x) => `${x[0]}=${x[1]}`)
      .join(",");
    if (filters.length) {
      args.push("-af", filters);
    }
    const ffmpeg = new prism.FFmpeg({
      args,
    });

    const opus = new prism.opus.Encoder({
      rate: 48000,
      channels: 2,
      frameSize: 960,
    });
    const fdata = (await this.player.requestManager.getStream()).pipe(ffmpeg);

    const resource = createAudioResource(fdata.pipe(opus), {
      inlineVolume: true,
      inputType: StreamType.Opus,
    });

    this.player.requestManager.currentStream = resource;
    resource.playbackDuration = time * 1000;
    this.player.play();
  }
}
