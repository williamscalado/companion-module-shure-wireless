// Simulador mínimo de receptor Shure SLXD (protocolo ASCII TCP 2202).
// Uso: node slxd-simulator.mjs [canais=2] [porta=2202]
import net from 'node:net'

const CHANNELS = Number(process.argv[2] ?? 2)
const PORT = Number(process.argv[3] ?? 2202)

const state = Array.from({ length: CHANNELS }, (_, i) => ({
	CHAN_NAME: `{Shure ${i + 1}}`,
	FREQUENCY: String(471125 + i * 1000),
	GROUP_CHANNEL: `{1,${i + 2}}`,
	AUDIO_GAIN: '014', // -4 dB (offset +18)
	TX_TYPE: 'SLXD2',
	TX_BATT_BARS: '004',
	TX_BATT_MINS: '00300',
}))

const rep = (sock, line) => sock.write(`< ${line} >`)

function sendAll(sock) {
	rep(sock, 'REP MODEL {SLXD4D}')
	state.forEach((ch, i) => {
		for (const [key, value] of Object.entries(ch)) rep(sock, `REP ${i + 1} ${key} ${value}`)
	})
}

function sendSamples(sock) {
	state.forEach((_, i) => {
		// SLX: SAMPLE <ch> ALL <audioPeak> <audioRms> <rf>, todos com offset +120
		const audio = 120 - Math.floor(Math.random() * 50) // 0..-50 dBFS
		const peak = Math.min(120, audio + 6)
		const rf = 120 - 30 - Math.floor(Math.random() * 60) // -30..-90 dBm
		const pad = (n) => String(n).padStart(3, '0')
		rep(sock, `SAMPLE ${i + 1} ALL ${pad(peak)} ${pad(audio)} ${pad(rf)}`)
	})
}

net
	.createServer((sock) => {
		console.log('Companion conectado', sock.remoteAddress)
		let meterTimer
		let buffer = ''

		sock.on('data', (chunk) => {
			buffer += chunk
			let end
			while ((end = buffer.indexOf('>')) !== -1) {
				const cmd = buffer.slice(0, end).replace('<', '').trim()
				buffer = buffer.slice(end + 1)
				console.log('<-', cmd)

				const [verb, target, key, ...rest] = cmd.split(' ')
				if (verb === 'GET' && key === 'ALL') sendAll(sock)
				else if (key === 'METER_RATE') {
					const rate = verb === 'SET' ? Number(rest[0]) : 5000
					rep(sock, `REP ${target === '0' ? 1 : target} METER_RATE ${String(rate).padStart(5, '0')}`)
					if (verb === 'SET') {
						clearInterval(meterTimer)
						if (rate > 0) meterTimer = setInterval(() => sendSamples(sock), rate)
					}
				} else if (verb === 'SET' && state[Number(target) - 1] && key in state[0]) {
					const ch = state[Number(target) - 1]
					let value = rest.join(' ')
					if (key === 'AUDIO_GAIN' && (rest[0] === 'INC' || rest[0] === 'DEC')) {
						const step = Number(rest[1]) * (rest[0] === 'INC' ? 1 : -1)
						value = String(Math.min(60, Math.max(0, Number(ch.AUDIO_GAIN) + step))).padStart(3, '0')
					}
					ch[key] = value
					rep(sock, `REP ${target} ${key} ${value}`)
				}
			}
		})

		sock.on('close', () => clearInterval(meterTimer))
		sock.on('error', (err) => console.error('socket error', err.message))
	})
	.listen(PORT, () => console.log(`SLXD simulado (${CHANNELS} canais) em 0.0.0.0:${PORT}`))
