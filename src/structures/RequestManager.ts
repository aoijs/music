import {
  AudioResource,
  createAudioResource,
  StreamType,
} from "@discordjs/voice";
import { ReadStream } from "fs";
import { Stream } from "m3u8stream";
import { Readable, PassThrough } from "stream";
import { YoutubeVideo } from "youtube-scrapper";
import { CacheType, LoopMode } from "../utils/constants";
import { Search } from "../utils/source/Search";
import { PossibleStream } from "../utils/typings";
import Player from "./Player";
import Track from "./Track";
import * as prism from "prism-media";

export class RequestManager {
  public nextStream: AudioResource = null;
  public currentStream: AudioResource = null;
  public search: Search;
  private player: Player;
  constructor(player: Player) {
    this.player = player;
    this.search = player.manager.searchManager;
  }
  /**
   * @param  {Track} track
   * @returns {Promise<void>}
   */
  public async setCurrentStream(track: Track): Promise<void> {
    let resource: AudioResource<unknown>;
    let rawstream = await this.getStream();
    let stream: Readable | PassThrough | Stream | prism.opus.Encoder;
    if (Object.keys(this.player.filterManager.filters).length) {
      const args = [...this.player.filterManager.args];
      const filters = Object.entries(this.player.filterManager.filters)
        .map((x) => `${x[0]}=${x[1]}`)
        .join(",");

      args.push("-af");
      args.push(filters);
      const ffmpeg = new prism.FFmpeg({
        args,
      });

      const opus = new prism.opus.Encoder({
        rate: 48000,
        channels: 2,
        frameSize: 960,
      });

      stream = rawstream.pipe(ffmpeg);
      resource = createAudioResource(stream, {
        inlineVolume: true,
        inputType: StreamType.Raw,
      });
    } else {
      stream = rawstream;
      resource = createAudioResource(stream, {
        inlineVolume: true,
        inputType: StreamType.Arbitrary,
      });
    }
    this.currentStream = resource;
    if (
      this.player.manager.config.cache.enabled &&
      !this.player.cacheManager.map.has(track.link) &&
      this.player.options.mode !== LoopMode.None
    ) {
      console.log("caching track");
      this.player.cacheManager.write(track.link, stream);
    }
  }
  /**
   * @param  {Track} track
   * @returns {Promise<void>}
   */
  public async setNextStream(track: Track): Promise<void> {
    let stream: ReadStream;
    if (!track) this.nextStream = null;
    else if (track.source === 0) {
      stream = await this.search.soundCloud.getStream(
        track.rawInfo.permalink_url,
      );
    } else if (track.source === 1) {
      stream = await this.search.localFile.getStream(track.rawInfo.path);
    } else if (track.source === 2) {
      stream = await this.search.attachment.getStream(track.rawInfo.url);
    }
    const resource = createAudioResource(stream, {
      inlineVolume: true,
      inputType: StreamType.Arbitrary,
    });
    this.nextStream = resource;
  }
  /**
   * @returns {number}
   */
  public get _currentDuration(): number {
    return this.currentStream.playbackDuration;
  }
  /**
   * e
   */
  /**
   * @param  {number} number
   * @returns void
   */
  public _setVolume(number: number): void {
    return this.currentStream.volume.setVolume(number);
  }
  /**
   * getStream
   */
  public async getStream() {
    let stream: Readable | PassThrough | ReadStream | Stream;
    const track = this.player.queue.current;
    if (this.player.cacheManager.map.has(track.link)) {
      return this.player.cacheManager.get(track.link);
    } else if (track.type === 0) {
      return await this.search.soundCloud.getStream(
        track.rawInfo.permalink_url,
      );
    } else if (track.type === 1) {
      return await this.search.localFile.getStream(track.rawInfo.path);
    } else if (track.type === 2) {
      return await this.search.attachment.getStream(track.rawInfo.url);
    } else if (track.type === 3 && track.rawInfo instanceof YoutubeVideo) {
      return await this.search.youtube.getStream(track.rawInfo);
      //console.log("using api");
    } else {
    }
  }
}
