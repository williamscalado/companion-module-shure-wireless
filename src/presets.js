import { combineRgb } from '@companion-module/base'

const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const RED = combineRgb(255, 0, 0)
const DARK_RED = combineRgb(128, 0, 0)
const NAVY = combineRgb(0, 0, 128)
const YELLOW = combineRgb(255, 255, 0)
const GAIN_STEP = '3'

/**
 * INTERNAL: initialize presets.
 *
 * @access protected
 * @since 2.3.2
 */
export function updatePresets() {
	let presets = {}
	let family = this.model.family
	let variable = (ch, name) => `$(${this.label}:ch_${ch}_${name})`

	let button = (category, name, text, feedbacks = [], down = [], size = '14', alignment = 'center:center') => ({
		type: 'button',
		category: category,
		name: name,
		style: { text: text, size: size, alignment: alignment, color: WHITE, bgcolor: BLACK },
		feedbacks: feedbacks,
		steps: [{ down: down, up: [] }],
	})

	// The text stays top-left in the small font so it does not overlap the icons drawn on the right and bottom
	let iconButton = (category, name, ch, text, icons, feedbacks = [], down = []) =>
		button(
			category,
			name,
			text,
			[{ feedbackId: 'sample', options: { channel: ch, labels: [], icons: icons, barlevel: 2 } }, ...feedbacks],
			down,
			'7',
			'left:top'
		)

	let batteryAlert = (ch) => ({
		feedbackId: 'battery_level',
		options: { channel: ch, barlevel: 2 },
		style: { color: WHITE, bgcolor: RED },
	})

	let statusButton = (ch, name, labels, icons) =>
		button(
			'Status',
			name,
			'',
			[
				{ feedbackId: 'sample', options: { channel: ch, labels: labels, icons: icons, barlevel: 2 } },
				batteryAlert(ch),
				{
					feedbackId: 'transmitter_turned_off',
					options: { channel: ch },
					style: { color: WHITE, bgcolor: NAVY },
				},
			],
			[],
			'7',
			'left:top'
		)

	// Full drops the battery icon: runtime goes as text and the icon would overlap the 6th line
	let fullIcons = {
		slx: ['rf', 'audio'],
		ulx: ['rf', 'audio', 'locks', 'encryption'],
		ad: ['rf', 'audio', 'locks', 'encryption', 'quality'],
	}
	fullIcons.qlx = fullIcons.ulx

	for (let ch = 1; ch <= this.model.channels; ch++) {
		let name = variable(ch, 'name')
		let gain = variable(ch, 'audio_gain')

		presets[`status_${ch}`] = statusButton(
			ch,
			`Channel ${ch} Status`,
			['name', 'frequency', 'groupChan', 'audioGain'],
			['battery', 'rf', 'audio']
		)

		presets[`status_full_${ch}`] = statusButton(
			ch,
			`Channel ${ch} Status Full`,
			['name', 'frequency', 'groupChan', 'audioGain', 'txType', 'batteryRuntime'],
			fullIcons[family]
		)

		presets[`gain_up_${ch}`] = iconButton(
			'Gain',
			`Channel ${ch} Gain +${GAIN_STEP} dB`,
			ch,
			`${name}\\nGAIN +${GAIN_STEP}\\n${gain}`,
			['audio'],
			[],
			[{ actionId: 'channel_increasegain', options: { channel: ch, gain: GAIN_STEP } }]
		)

		presets[`gain_down_${ch}`] = iconButton(
			'Gain',
			`Channel ${ch} Gain -${GAIN_STEP} dB`,
			ch,
			`${name}\\nGAIN -${GAIN_STEP}\\n${gain}`,
			['audio'],
			[],
			[{ actionId: 'channel_decreasegain', options: { channel: ch, gain: GAIN_STEP } }]
		)

		presets[`gain_reset_${ch}`] = iconButton(
			'Gain',
			`Channel ${ch} Gain 0 dB`,
			ch,
			`${name}\\nGAIN 0 dB\\n${gain}`,
			['audio'],
			[
				{
					feedbackId: 'channel_gain',
					options: { channel: ch, gain: 0 },
					style: { color: BLACK, bgcolor: YELLOW },
				},
			],
			[{ actionId: 'channel_setaudiogain', options: { channel: ch, gain: '0' } }]
		)

		presets[`battery_${ch}`] = iconButton(
			'Battery',
			`Channel ${ch} Battery`,
			ch,
			`${name}\\nBATTERY\\n${variable(ch, 'battery_runtime')}`,
			['battery'],
			[batteryAlert(ch)]
		)

		presets[`meter_${ch}`] = iconButton(
			'Meter',
			`Channel ${ch} RF / Audio`,
			ch,
			`${name}\\nRF\\n${variable(ch, family == 'ad' ? 'rf_level_a' : 'rf_level')}\\nAF\\n${variable(
				ch,
				'audio_level'
			)}`,
			['rf', 'audio']
		)

		if (family == 'ad' || family == 'slx') {
			presets[`identify_${ch}`] = iconButton(
				'Identify',
				`Channel ${ch} Flash`,
				ch,
				`IDENTIFY\\n${name}`,
				['battery', 'rf'],
				[],
				[{ actionId: 'flash_channel', options: { channel: ch } }]
			)
		}

		if (family == 'ulx' || family == 'ad') {
			presets[`mute_${ch}`] = iconButton(
				'Mute',
				`Channel ${ch} Mute Toggle`,
				ch,
				`MUTE\\n${name}`,
				['audio'],
				[
					{
						feedbackId: 'channel_muted',
						options: { channel: ch },
						style: { color: WHITE, bgcolor: DARK_RED },
					},
				],
				[{ actionId: 'channel_mute', options: { channel: ch, choice: 'TOGGLE' } }]
			)
		}
	}

	if (family != 'qlx') {
		presets['identify_receiver'] = button(
			'Identify',
			'Receiver Flash',
			'ID\\nRX',
			[],
			[{ actionId: 'flash_lights', options: {} }]
		)
	}

	this.setPresetDefinitions(presets)
}
