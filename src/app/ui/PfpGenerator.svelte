<script lang="ts">
	import {EntropyProducer} from '#/crypto/entropy';

	const A_PLANET_RADII = [75, 100, 125];

	const A_MOON_RADII = [20, 22, 25, 27, 30];

	const A_ORBITS = [
		{
			planet: [80, 125],
			shells: [200],
		},
		{
			planet: [70, 100],
			shells: [165, 230],
		},
		{
			planet: [60, 80],
			shells: [130, 195, 260],
		},
	];

	// number of variables needed
	const N_VARIABLES = 1 + 4 + 1 + (3 * 5);

	export let seed = crypto.getRandomValues(new Uint8Array(32));

	export let offset: number;

	export let svgElement: SVGSVGElement;

	interface Generated {
		bg: number;
		planet: {
			size: number;
			start: number;
			finish: number;
			angle: number;
		};
		moons: {
			orbit: number;
			cycle: number;
			size: number;
			start: number;
			finish: number;
			angle: number;
		}[];
	}

	function gradient(k_ent: EntropyProducer) {
		const n_hue_start = k_ent.randomInt(0, 360);
		const n_hue_delta = k_ent.randomInt(60, 300);

		return {
			start: n_hue_start,
			finish: (n_hue_start + n_hue_delta) % 360,
		};
	}

	const A_CHASMS = [0, 30, 47];

	async function generate(i_iterator: number): Promise<Generated> {
		const k_ent = await EntropyProducer.create(N_VARIABLES, i_iterator, seed);

		const g_orbit = k_ent.select(A_ORBITS);
		const a_planet = g_orbit.planet;

		return {
			bg: k_ent.randomInt(301, 220),
			planet: {
				size: k_ent.randomInt(a_planet[1], a_planet[0]),
				angle: k_ent.randomInt(360),
				...gradient(k_ent),
			},
			moons: g_orbit.shells.map((x_orbit, i_orbit) => {
				let x_angle = k_ent.randomInt(360);

				if(i_orbit >= 1) {
					const x_chasm = A_CHASMS[i_orbit];

					if(x_angle > 90-x_chasm && x_angle < 90+x_chasm) {
						x_angle -= 90;
					}
					else if(x_angle > 270-x_chasm && x_angle < 270+x_chasm) {
						x_angle -= 90;
					}
				}

				return {
					orbit: x_orbit,
					cycle: k_ent.randomInt(360),
					size: k_ent.select(A_MOON_RADII),
					angle: x_angle,
					...gradient(k_ent),
				};
			}),
		};
	}
	
	
</script>

<style lang="less">
	svg.pfpg {
		width: 100%;
		height: auto;
		border-radius: 10px;
		border: 1px solid var(--theme-color-border);
	}
</style>

<svg xmlns="http://www.w3.org/2000/svg" width="640" height="428" viewBox="0 0 640 428" class="pfpg" bind:this={svgElement}>
	<style>
		.background {
			transform: scaleX(1.2);
		}
	
		.planet {
			transform-origin: 50% 50%;
		}
	
		.orbit {
			fill: none;
			stroke: #ffffff;
			opacity: 0.1;
		}
	
		.moon {
			transform-origin: 50% 50%;
		}
	</style>

	{#await generate(offset) then g_gen}
		<defs>
			<radialGradient id="pfpg-background" cx="0" cy="0" r="100%">
				<stop offset="0%" stop-color={`hsl(${g_gen.bg-40}, 100%, 15%)`} />
				<stop offset="50%" stop-color={`hsl(${g_gen.bg}, 100%, 10%)`} />
				<stop offset="100%" stop-color={`hsl(${g_gen.bg+40}, 100%, 15%)`} />
			</radialGradient>

			<radialGradient id="pfpg-planet" cx="25%" cy="25%" r="75%">
				<stop offset="0%" stop-color={`hsl(${g_gen.planet.start}, 100%, 50%)`} stop-opacity="0" />
				<stop offset="100%" stop-color={`hsl(${g_gen.planet.finish}, 100%, 50%)`} stop-opacity="1" />
			</radialGradient>

			{#each g_gen.moons as {start:n_start, finish:n_finish}, i_moon}
				<radialGradient id={`pfpg-moon-${i_moon}`} cx="0" cy="0" r="100%">
					<stop offset="0%" stop-color={`hsl(${n_start}, 100%, 50%)`} />
					<stop offset="100%" stop-color={`hsl(${n_finish}, 100%, 25%)`} />
				</radialGradient>
			{/each}
		</defs>

		<!-- background -->
		<rect class="background" x="0" y="0" width="100%" height="100%" fill="url(#pfpg-background)" />

		<!-- planet -->
		<circle class="planet" cx="50%" cy="50%" r={g_gen.planet.size} fill="url(#pfpg-planet)"
			style={`transform:rotate(${g_gen.planet.angle}deg)`}/>

		<!-- orbits -->
		{#each g_gen.moons as {orbit:x_r}}
			<circle class="orbit" cx="50%" cy="50%" r={x_r} />
		{/each}

		<!-- moons -->
		{#each g_gen.moons as {cycle:x_angle, orbit:x_r, size:x_size}, i_moon}
			<g class="moon" id={`moon-${i_moon}`} style={`transform:rotate(${x_angle}deg) translate(${x_r}px);`}>
				<circle fill={`url(#pfpg-moon-${i_moon})`} cx="50%" cy="50%" r={x_size} />
			</g>
		{/each}
	{/await}
</svg>