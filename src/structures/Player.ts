import { GuildMember, TextChannel, VoiceChannel } from "discord.js";
import {
	AudioPlayerStatus,
	joinVoiceChannel,
	VoiceConnection,
} from "@discordjs/voice";
import { LoopMode, PlayerStates } from "../utils/constants";
import { PlayerOptions, PlayerOptionsData, voiceState } from "../utils/typings";
import { AudioPlayer } from "@discordjs/voice";
import Manager from "./Manager";
import Queue from "./Queue";
import { setTimeout } from "timers/promises";
import Track from "./Track";
import requestManager from "./requestManager";

class Player {
	public voiceState: voiceState = {} as any;
	public debug: boolean;
	public requestManager: requestManager;
	public manager: Manager;
	public connection: VoiceConnection;
	public voiceChannel: VoiceChannel;
	public textChannel: TextChannel;
	//public mode: LoopMode = LoopMode.None;
	public queue: Queue = new Queue();
	public options: PlayerOptionsData;
	private _state: PlayerStates = PlayerStates.Idling;
	private player: AudioPlayer = new AudioPlayer();
	constructor(data: PlayerOptions) {
		this.connection = data.connection;
		this.voiceChannel = data.voiceChannel;
		this.textChannel = data.textChannel;
		this.manager = data.manager;
		this.requestManager = new requestManager(this);
		this._defaultOptions();
		this.debug = data.debug;
		this._configPlayer();
	}

	get state() {
		return PlayerStates[this._state];
	}
	set state(n) {
		if (this.state === n) return;
		this._state = PlayerStates[n];
	}

	/**
	 * search
	 */
	public async search(query: string, type: number): Promise<any[]> {
		return await this.manager.searchManager.search({ query, type });
	}

	/**
	 * addTrack
	 */
	public async addTrack({
		urls,
		type,
		member,
	}: {
		urls: string[];
		type: number;
		member: GuildMember;
	}): Promise<void> {
		if (type === 0) {
			for (const url of urls) {
				const info = await this.manager.searchManager.soundCloud.getInfo(url);
				if (!info) {
					console.error(`Cannot Get Data Of ${url}`);
					continue;
				}
				const track: Track = new Track({
					requestUser: member,
					rawinfo: info,
					type,
				});
				this.queue.list.push(track);
				if (this.queue.list.length === 1) {
					this.queue.setCurrent(track);
					console.log("added first track");
					await this.requestManager.setCurrentStream(track);
					this.play();
					console.log("started playing");
				}
				await setTimeout(5000);
			}
		} else if (type === 1) {
			for (const url of urls) {
				const info = await this.manager.searchManager.localFile.getInfo(url);
				if (!info) {
					console.error(`Cannot Get Data Of ${url}`);
					continue;
				}
				const track: Track = new Track({
					requestUser: member,
					rawinfo: info,
					type,
				});
				this.queue.list.push(track);
				if (this.queue.list.length === 1) {
					this.queue.setCurrent(track);
					await this.requestManager.setCurrentStream(track);
					this.play();
				}
				await setTimeout(5000);
			}
		} else if (type === 2) {
			for (const url of urls) {
				const info = await this.manager.searchManager.attachment.getInfo(url);
				if (!info) {
					console.error(`Cannot Get Data Of ${url}`);
					continue;
				}
				const track: Track = new Track({
					requestUser: member,
					rawinfo: info,
					type,
				});
				this.queue.list.push(track);
				if (this.queue.list.length === 1) {
					this.queue.setCurrent(track);
					await this.requestManager.setCurrentStream(track);
					this.play();
				}
				await setTimeout(5000);
			}
		} else throw new Error(`Invalid Type: '${type}' Provided`);
	}

	play() {
		const resource = this.requestManager.currentStream;
		this.player.play(resource);
	}

	join(channel: VoiceChannel) {
		this.voiceState.connection = joinVoiceChannel({
			channelId: channel.id,
			guildId: channel.guildId,
			adapterCreator: channel.guild.voiceAdapterCreator,
			group: channel.client.user.id,
		});
		this.voiceState.channel = channel;
	}

	public _configPlayer(): void {
		this.player.on("stateChange", async (os, ns) => {
			console.log([os.status, ns.status]?.join("|"));
			if (
				os.status !== AudioPlayerStatus.Idle &&
				ns.status === AudioPlayerStatus.Idle
			) {
				if (this.options.paused) return;
				else if (this.options.mode === LoopMode.Track && this.queue.current) {
					//this._playSingleTrack()
				} else if (
					this.options.mode === LoopMode.Queue &&
					this.queue.list.length
				) {
					//this._loopQueue()
				} else if (this.queue.list.length > 1) {
					this._playNextTrack();
				} else {
					this._destroyPlayer();
				}
			}
		});
		this.player.on("error", async (message) => console.error(message));
		if (this.debug) {
			this.player.on("debug", console.log);
		}

		this.connection.subscribe(this.player);
	}
	_defaultOptions() {
		this.options = {
			paused: false,
			mode: LoopMode.None,
			volume: 100,
			leaveAfter: { enabled: false, time: 60000 },
			leaveWhenVcEmpty: false,
		};
	}
	async _playNextTrack(): Promise<void> {
		const track = this.queue.list.shift();
		this.queue.previous = track;
		this.queue.setCurrent( this.queue.list[ 0 ] );
		await this.requestManager.setCurrentStream(this.queue.list[0])
		this.play();
	}
	_destroyPlayer(): void {
		this._defaultOptions();
		this.queue = new Queue();
		this.requestManager = new requestManager(this);
	}
}

export default Player;
