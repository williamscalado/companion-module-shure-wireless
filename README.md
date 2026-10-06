# companion-module-shure-wireless-cv

Fork do módulo [bitfocus/companion-module-shure-wireless](https://github.com/bitfocus/companion-module-shure-wireless) mantido para a Cidade Viva, com suporte aos ícones de status no Companion v5 e presets prontos.

Documentação de uso dentro do Companion: [`companion/HELP.md`](companion/HELP.md).

## 1. O que este app faz

Módulo do [Bitfocus Companion](https://bitfocus.io/companion) que conecta nos receptores de microfone sem fio da Shure via TCP (protocolo ASCII da Shure, porta `2202`) para:

- **Monitorar** cada canal em tempo real: nome, frequência, grupo/canal, ganho, transmissor, bateria, nível de RF e de áudio.
- **Exibir** o status no botão com ícones (bateria, RF, áudio, antena, lock, criptografia, qualidade) desenhados pelo próprio módulo.
- **Controlar** o receptor: ganho, frequência, nome do canal, mute (ULX/AD), identificação por LED e RF dos slots (AD).

Modelos suportados:

| Model Type (config)   | Família | Canais | Slots |
| --------------------- | ------- | ------ | ----- |
| ULXD4 Single Receiver | `ulx`   | 1      | —     |
| ULXD4D Dual Receiver  | `ulx`   | 2      | —     |
| ULXD4Q Quad Receiver  | `ulx`   | 4      | —     |
| QLXD4 Single Receiver | `qlx`   | 1      | —     |
| SLXD4 Single Receiver | `slx`   | 1      | —     |
| SLXD4D Dual Receiver  | `slx`   | 2      | —     |
| AD4D Dual Receiver    | `ad`    | 2      | 8     |
| AD4Q Quad Receiver    | `ad`    | 4      | 8     |

O **Model Type** precisa corresponder ao receptor real: cada família tem um formato próprio de amostra (`SAMPLE`), e um modelo errado faz os medidores de RF e áudio mostrarem valores trocados.

### O que muda neste fork

| Mudança                      | Detalhe                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ícones no Companion v3–v5    | O feedback `sample` enviava `imageBuffers` (campo inexistente no `@companion-module/base` 1.x) e os ícones não apareciam. Agora envia `imageBuffer` + `imageBufferEncoding` (ARGB) + `imageBufferPosition`. |
| Ícones combináveis com texto | O `sample` sem labels devolve só a imagem e mantém o texto do botão.                                                                                                                                        |
| Presets                      | Presets prontos por categoria (Status, Status Full, Gain, Battery, Meter, Identify, Mute).                                                                                                                  |
| Simulador                    | `tools/slxd-simulator.mjs` para testar sem receptor.                                                                                                                                                        |
| Identificação                | Módulo renomeado para `shure-wireless-cv` (shortname `shure-wx-cv`), podendo ser instalado junto do módulo original.                                                                                        |

### Estrutura do projeto

| Caminho                         | Responsabilidade                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/index.js`                  | Instância do módulo: config, conexão TCP, heartbeat, roteamento das mensagens (`REP` / `SAMPLE`) e envio de comandos |
| `src/actions.js`                | Definição das actions por família                                                                                    |
| `src/feedback.js`               | Definição dos feedbacks por família, incluindo o `sample` (ícones)                                                   |
| `src/presets.js`                | Presets por canal e categoria                                                                                        |
| `src/variables.js`              | Definição e valores iniciais das variáveis                                                                           |
| `src/internalAPI.js`            | Estado de receptor, canais e slots; parsing de `REP` e `SAMPLE`; seleção dos ícones                                  |
| `src/icons.js`                  | Ícones em PNG (base64) e composição do status por família                                                            |
| `src/vendor/companion/Image.js` | Buffer ARGB com desenho de PNG (via `pngjs`)                                                                         |
| `src/setup.js`                  | Modelos suportados, choices e campos reutilizados em actions/feedbacks                                               |
| `src/upgrades.js`               | Mapa de upgrade dos feedbacks legados para boolean                                                                   |
| `companion/manifest.json`       | Manifesto do módulo (id, nome, runtime, produtos)                                                                    |
| `companion/HELP.md`             | Ajuda exibida dentro do Companion                                                                                    |
| `tools/slxd-simulator.mjs`      | Simulador de receptor SLXD para testes                                                                               |

### Fluxo de dados

```
Receptor Shure ──TCP 2202──▶ index.js (separa mensagens no '>')
                               │
                               ├─ REP ...           ─▶ internalAPI.updateChannel / updateSlot / updateReceiver
                               │                        └─ setVariableValues + checkFeedbacks
                               │
                               └─ SAMPLE <ch> ALL … ─▶ internalAPI.parse{SLX|ULX|AD}Sample
                                                        └─ checkFeedbacks('sample') ─▶ getIcon ─▶ imageBuffer

Botão (action) ─▶ actions.js ─▶ sendCommand('SET …') ─▶ Receptor
```

## 2. Quick start

Pré-requisitos: Node.js 18+ e Yarn 1.x.

```bash
yarn install
```

Rodar no Companion sem gerar pacote:

1. No launcher do Companion, configure **Developer modules path** apontando para a pasta que contém este repositório.
2. Crie uma conexão **shure-wireless-cv**.
3. Configure **Target IP**, **Model Type** e habilite **Metering**.

Sem receptor disponível, use o simulador:

```bash
node tools/slxd-simulator.mjs 2 2202
```

E aponte a conexão para `127.0.0.1:2202` com Model Type `SLXD4D Dual Receiver`. Detalhes em [Testes](#8-testes).

## 3. Build e deploy

Gerar o pacote do módulo:

```bash
yarn companion-module-build
```

Saída: `shure-wireless-cv-<versão>.tgz` na raiz (ignorado pelo git). A versão vem do `package.json`.

Deploy no Companion:

1. **Modules** → importar o `.tgz`.
2. Na conexão `shure-wireless-cv`, selecionar a versão importada.

Ao gerar um novo pacote para testar, suba a versão no `package.json`: o Companion mantém versões já importadas e pode não substituir um pacote com a mesma versão.

Formatação:

```bash
yarn format
```

O workflow `.github/workflows/companion-module-checks.yaml` roda as verificações padrão da Bitfocus a cada push.

## 4. Interface com o Companion

O módulo não expõe rotas HTTP. A interface com o Companion é feita por **actions**, **feedbacks**, **presets** e **variáveis**, registrados conforme a família do modelo configurado.

### Actions (`src/actions.js`)

| Action                 | Descrição                                 | ULX | QLX | SLX | AD  |
| ---------------------- | ----------------------------------------- | :-: | :-: | :-: | :-: |
| `set_channel_name`     | Define o nome do canal (até 8 caracteres) | ✅  | ✅  | ✅  | ✅  |
| `channel_setaudiogain` | Define o ganho (−18 a +42 dB)             | ✅  | ✅  | ✅  | ✅  |
| `channel_increasegain` | Aumenta o ganho em X dB                   | ✅  | ✅  | ✅  | ✅  |
| `channel_decreasegain` | Diminui o ganho em X dB                   | ✅  | ✅  | ✅  | ✅  |
| `channel_frequency`    | Define a frequência (MHz)                 | ✅  | ✅  | ✅  | ✅  |
| `flash_lights`         | Pisca os LEDs do receptor (30 s)          | ✅  |  —  | ✅  | ✅  |
| `flash_channel`        | Pisca os LEDs de um canal (60 s)          |  —  |  —  | ✅  | ✅  |
| `channel_mute`         | Mute / unmute / toggle do áudio do canal  | ✅  |  —  |  —  | ✅  |
| `slot_rf_output`       | RF on / mute do transmissor no slot       |  —  |  —  |  —  | ✅  |
| `slot_rf_power`        | Potência de RF do slot (low/normal/high)  |  —  |  —  |  —  | ✅  |

Os campos de nome, ganho e frequência aceitam variáveis do Companion.

### Feedbacks (`src/feedback.js`)

| Feedback                 | Tipo     | Ativa quando                                     | Famílias     |
| ------------------------ | -------- | ------------------------------------------------ | ------------ |
| `sample`                 | advanced | Desenha ícones e, opcionalmente, labels do canal | todas        |
| `battery_level`          | boolean  | Barras de bateria ≤ nível configurado            | todas        |
| `transmitter_turned_off` | boolean  | Transmissor desligado ou sem dados               | todas        |
| `channel_frequency`      | boolean  | Frequência igual ao valor                        | todas        |
| `channel_gain`           | boolean  | Ganho igual ao valor                             | todas        |
| `channel_muted`          | boolean  | Áudio do canal mutado                            | ULX, AD      |
| `transmitter_muted`      | boolean  | Transmissor mutado                               | ULX, QLX, AD |
| `interference_status`    | boolean  | Interferência detectada                          | ULX, QLX, AD |
| `slot_is_active`         | boolean  | Slot é o transmissor ativo do canal              | AD           |
| `slot_status`            | boolean  | Status do slot igual ao valor                    | AD           |
| `slot_rf_output`         | boolean  | RF do slot igual ao valor                        | AD           |
| `slot_rf_power`          | boolean  | Potência do slot igual ao valor                  | AD           |

#### Opções do feedback `sample`

| Opção               | Descrição                                                         |
| ------------------- | ----------------------------------------------------------------- |
| Channel             | Canal monitorado                                                  |
| Label Data          | Linhas de texto exibidas (vazio = mantém o texto do botão)        |
| Icons               | Ícones desenhados                                                 |
| Battery Alert Level | Barras a partir das quais a bateria fica vermelha (1–5, padrão 2) |

Labels disponíveis:

| Label            | Texto exibido                | ULX/QLX | SLX | AD  |
| ---------------- | ---------------------------- | :-----: | :-: | :-: |
| `name`           | Nome do canal                |   ✅    | ✅  | ✅  |
| `txDeviceId`     | ID do transmissor            |   ✅    |  —  | ✅  |
| `frequency`      | Frequência                   |   ✅    | ✅  | ✅  |
| `groupChan`      | Grupo/canal                  |   ✅    | ✅  | ✅  |
| `audioGain`      | Ganho (ex.: `+3 dB`)         |   ✅    | ✅  | ✅  |
| `txType`         | Modelo do transmissor        |   ✅    | ✅  | ✅  |
| `txPowerLevel`   | Potência (`mW` ou `Unknown`) |   ✅    |  —  | ✅  |
| `batteryType`    | Tipo de bateria              |   ✅    |  —  | ✅  |
| `batteryRuntime` | Tempo de bateria             |   ✅    | ✅  | ✅  |

Ícones disponíveis:

| Ícone        | Desenho                                | ULX/QLX | SLX | AD  |
| ------------ | -------------------------------------- | :-----: | :-: | :-: |
| `battery`    | Bateria no canto inferior esquerdo     |   ✅    | ✅  | ✅  |
| `rf`         | Coluna de RF (+ antenas no ULX/QLX/AD) |   ✅    | ✅  | ✅  |
| `audio`      | Coluna de nível de áudio               |   ✅    | ✅  | ✅  |
| `locks`      | Lock de menu/power do transmissor      |   ✅    |  —  | ✅  |
| `encryption` | Status de criptografia                 |   ✅    |  —  | ✅  |
| `quality`    | Qualidade do sinal                     |    —    |  —  | ✅  |

### Presets (`src/presets.js`)

Gerados por canal do modelo configurado e agrupados por categoria na aba **Presets** da conexão:

| Categoria | Preset                  | Conteúdo                                                                                          | Alertas                                      | Famílias     |
| --------- | ----------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------ |
| Status    | Channel N Status        | Nome, frequência, grupo/canal, ganho + ícones de bateria, RF e áudio                              | vermelho: bateria baixa · azul: TX desligado | todas        |
| Status    | Channel N Status Full   | Nome, frequência, grupo/canal, ganho, modelo do TX, tempo de bateria + todos os ícones da família | vermelho: bateria baixa · azul: TX desligado | todas        |
| Gain      | Gain +3 dB / Gain −3 dB | Ajusta o ganho; mostra nome, passo e ganho atual + ícone de áudio                                 | —                                            | todas        |
| Gain      | Gain 0 dB               | Volta o ganho a 0 dB + ícone de áudio                                                             | amarelo: ganho em 0 dB                       | todas        |
| Battery   | Channel N Battery       | Nome, tempo restante + ícone de bateria                                                           | vermelho: bateria baixa                      | todas        |
| Meter     | Channel N RF / Audio    | RF (dBm) e áudio (dBFS) em texto + ícones de RF e áudio                                           | —                                            | todas        |
| Identify  | Channel N Flash         | Pisca o canal + ícones de bateria e RF                                                            | —                                            | SLX, AD      |
| Identify  | Receiver Flash          | Pisca o receptor                                                                                  | —                                            | ULX, SLX, AD |
| Mute      | Channel N Mute Toggle   | Alterna o mute + ícone de áudio                                                                   | vermelho escuro: mutado                      | ULX, AD      |

Os presets usam as variáveis da conexão (`$(<label>:ch_N_name)`, `$(<label>:ch_N_audio_gain)` etc.), então refletem o nome definido no receptor.

### Variáveis (`src/variables.js`)

Prefixo por canal `ch_N_` e por slot `slot_N-MM_` (AD, ex.: `slot_1-03_status`). Variáveis sem prefixo são do receptor. Com **Variable Format** = `Include Units`, os valores incluem a unidade (`dB`, `dBm`, `dBFS`, `MHz`, `mW`, `ms`, `%`).

| Variável                      | Nome no Companion              | Famílias      |
| ----------------------------- | ------------------------------ | ------------- |
| `device_id`                   | Device ID                      | todas         |
| `high_density_mode`           | High Density Mode              | ULX, AD       |
| `encryption`                  | Encryption                     | ULX, QLX, AD  |
| `firmware_version`            | Firmware Version               | todas         |
| `model`                       | Receiver Model                 | SLX, AD       |
| `rf_band`                     | RF Band                        | SLX, AD       |
| `lock_status`                 | Lock Status                    | SLX           |
| `quadversity_mode`            | Quadversity Mode               | AD            |
| `ch_N_name`                   | Name                           | todas         |
| `ch_N_meter_rate`             | Meter Rate                     | todas         |
| `ch_N_audio_gain`             | Audio Gain                     | todas         |
| `ch_N_audio_mute`             | Audio Mute                     | ULX, AD       |
| `ch_N_group_chan`             | Group & Channel                | todas         |
| `ch_N_frequency`              | Frequency                      | todas         |
| `ch_N_encryption_status`      | Encryption Status              | ULX, QLX, AD  |
| `ch_N_interference_status`    | Interference Status            | ULX, AD       |
| `ch_N_antenna`                | Antenna Status                 | ULX, QLX, AD  |
| `ch_N_rf_level`               | RF Level                       | ULX, QLX, SLX |
| `ch_N_audio_level`            | Audio Level                    | todas         |
| `ch_N_tx_model`               | Transmitter Model              | todas         |
| `ch_N_tx_device_id`           | Transmitter Device ID          | ULX, QLX, AD  |
| `ch_N_tx_offset`              | Transmitter Offset             | ULX, QLX, AD  |
| `ch_N_tx_power_level`         | Transmitter Power Level        | ULX, QLX, AD  |
| `ch_N_tx_mute_status`         | Transmitter Mute Status        | ULX, QLX, AD  |
| `ch_N_tx_lock`                | Transmitter Lock               | ULX, QLX, AD  |
| `ch_N_tx_power_lock`          | Transmitter Power Lock         | ULX, QLX, AD  |
| `ch_N_tx_menu_lock`           | Transmitter Menu Lock          | ULX, QLX, AD  |
| `ch_N_tx_power_mode`          | Transmitter Power Mode         | ULX, QLX      |
| `ch_N_tx_power_source`        | Transmitter Power Source       | ULX, QLX      |
| `ch_N_tx_talk_switch`         | Transmitter Mute Button Status | ULX, QLX, AD  |
| `ch_N_battery_bars`           | Battery Bars                   | todas         |
| `ch_N_battery_charge`         | Battery Charge Status          | ULX, QLX, AD  |
| `ch_N_battery_cycle`          | Battery Cycle                  | ULX, QLX, AD  |
| `ch_N_battery_runtime`        | Battery Run Time               | todas         |
| `ch_N_battery_temp_f`         | Battery Temperature (F)        | ULX, QLX, AD  |
| `ch_N_battery_temp_c`         | Battery Temperature (C)        | ULX, QLX, AD  |
| `ch_N_battery_type`           | Battery Type                   | ULX, QLX, AD  |
| `ch_N_audio_out_lvl_switch`   | Audio Out Level Switch         | SLX           |
| `ch_N_audio_level_peak`       | Audio Level Peak               | SLX, AD       |
| `ch_N_unregistered_tx_status` | Unregistered TX Status         | AD            |
| `ch_N_fd_mode`                | FD Mode                        | AD            |
| `ch_N_group_chan2`            | Group & Channel 2              | AD            |
| `ch_N_frequency2`             | Frequency 2                    | AD            |
| `ch_N_interference_status2`   | Interference Status 2          | AD            |
| `ch_N_signal_quality`         | Signal Quality                 | AD            |
| `ch_N_rf_level_a`             | RF Level A                     | AD            |
| `ch_N_rf_level_b`             | RF Level B                     | AD            |
| `ch_N_rf_level_c`             | RF Level C                     | AD            |
| `ch_N_rf_level_d`             | RF Level D                     | AD            |
| `ch_N_tx_input_pad`           | Transmitter Input Pad          | AD            |
| `ch_N_tx_polarity`            | Transmitter Polarity           | AD            |
| `ch_N_battery_health`         | Battery Health                 | AD            |
| `slot_N-MM_status`            | Status                         | AD            |
| `slot_N-MM_link_status`       | Showlink Status                | AD            |
| `slot_N-MM_tx_type`           | Transmitter Type               | AD            |
| `slot_N-MM_tx_device_id`      | Transmitter Device ID          | AD            |
| `slot_N-MM_tx_offset`         | Transmitter Offset             | AD            |
| `slot_N-MM_tx_input_pad`      | Transmitter Input Pad          | AD            |
| `slot_N-MM_tx_polarity`       | Transmitter Polarity           | AD            |
| `slot_N-MM_tx_power_level`    | Transmitter Power Level        | AD            |
| `slot_N-MM_tx_power_mode`     | Transmitter Power Mode         | AD            |
| `slot_N-MM_tx_rf_output`      | Transmitter RF Output          | AD            |
| `slot_N-MM_battery_bars`      | Battery Bars                   | AD            |
| `slot_N-MM_battery_charge`    | Battery Charge Status          | AD            |
| `slot_N-MM_battery_cycle`     | Battery Cycle                  | AD            |
| `slot_N-MM_battery_health`    | Battery Health                 | AD            |
| `slot_N-MM_battery_runtime`   | Battery Run Time               | AD            |
| `slot_N-MM_battery_type`      | Battery Type                   | AD            |

## 5. Comandos do protocolo e exemplos

Comunicação TCP em texto, cada mensagem entre `<` e `>`.

| Direção           | Comando                             | Quando                            | Exemplo                           |
| ----------------- | ----------------------------------- | --------------------------------- | --------------------------------- |
| Módulo → receptor | `GET 0 ALL`                         | Ao conectar                       | `< GET 0 ALL >`                   |
| Módulo → receptor | `SET 0 METER_RATE <ms>`             | Ao conectar / ao mudar o metering | `< SET 0 METER_RATE 5000 >`       |
| Módulo → receptor | `GET 1 METER_RATE`                  | Heartbeat a cada 30 s             | `< GET 1 METER_RATE >`            |
| Módulo → receptor | `SET <ch> CHAN_NAME {nome}`         | Action de nome                    | `< SET 1 CHAN_NAME {PASTOR} >`    |
| Módulo → receptor | `SET <ch> AUDIO_GAIN <valor+18>`    | Action de ganho                   | `< SET 1 AUDIO_GAIN 14 >` (−4 dB) |
| Módulo → receptor | `SET <ch> AUDIO_GAIN INC/DEC <dB>`  | Gain + / −                        | `< SET 1 AUDIO_GAIN INC 3 >`      |
| Módulo → receptor | `SET <ch> FREQUENCY <kHz>`          | Action de frequência              | `< SET 1 FREQUENCY 471125 >`      |
| Módulo → receptor | `SET <ch> AUDIO_MUTE ON/OFF/TOGGLE` | Mute (ULX/AD)                     | `< SET 1 AUDIO_MUTE TOGGLE >`     |
| Módulo → receptor | `SET [<ch>] FLASH ON`               | Identify                          | `< SET 1 FLASH ON >`              |
| Receptor → módulo | `REP <ch> <PARÂMETRO> <valor>`      | Resposta / mudança de estado      | `< REP 1 TX_BATT_BARS 004 >`      |
| Receptor → módulo | `SAMPLE <ch> ALL ...`               | A cada intervalo de metering      | ver abaixo                        |

Formato do `SAMPLE` por família:

| Família   | Formato                                                                                    | Exemplo                        |
| --------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| SLX       | `SAMPLE <ch> ALL <pico+120> <rms+120> <rf+120>`                                            | `< SAMPLE 1 ALL 112 105 075 >` |
| ULX / QLX | `SAMPLE <ch> ALL <antena> <rf+128> <áudio+50>`                                             | `< SAMPLE 1 ALL AX 090 040 >`  |
| AD        | `SAMPLE <ch> ALL <qualidade> <LED áudio> <pico> <rms> <antenas> <bitmap/RF por antena...>` | —                              |

### Parâmetros `REP` tratados

Canal (`REP <ch> <PARÂMETRO> <valor>`):

| Parâmetro                                                            | Conversão / uso                                                        |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `CHAN_NAME`                                                          | Remove `{}`; atualiza o nome e as choices de canal                     |
| `METER_RATE`                                                         | `0` = Disabled; reinicia o timeout do heartbeat                        |
| `AUDIO_GAIN`                                                         | valor − 18 = dB                                                        |
| `AUDIO_MUTE`                                                         | `ON` / `OFF`                                                           |
| `GROUP_CHANNEL` / `GROUP_CHANNEL2`                                   | `{g,c}` → `g,c` (`--` quando vazio)                                    |
| `FREQUENCY` / `FREQUENCY2`                                           | `471125` → `471.125` MHz                                               |
| `*ENCRYPTION*`                                                       | `ON` → `ERROR`, `OFF` → `OK`                                           |
| `RF_INT_DET` / `INTERFERENCE_STATUS`                                 | `CRITICAL` → `DETECTED`                                                |
| `FLASH`, `AUDIO_OUT_LVL_SWITCH`, `UNREGISTERED_TX_STATUS`, `FD_MODE` | Valor direto                                                           |
| `TX_TYPE` / `TX_MODEL`                                               | Valor direto (`Unknown` antes de receber)                              |
| `TX_DEVICE_ID`                                                       | Remove `{}`                                                            |
| `TX_OFFSET`                                                          | dB; no AD valor − 12; `255` = Unknown                                  |
| `TX_INPUT_PAD`                                                       | valor − 12 dB; `255` = Unknown                                         |
| `TX_LOCK`, `TX_MENU_LOCK`, `TX_PWR_LOCK`                             | Lock de menu/power                                                     |
| `TX_MUTE_STATUS`, `TX_MUTE_MODE_STATUS`                              | Mute do transmissor                                                    |
| `TX_MUTE_BUTTON_STATUS`, `TX_TALK_SWITCH`, `BUTTON_STS`              | Botão de mute/talk                                                     |
| `TX_POWER_LEVEL`                                                     | mW; `255` = Unknown                                                    |
| `TX_RF_PWR`, `*POWER_MODE`                                           | ULX/QLX: `LOW`/`NORMAL`/`HIGH` → 1/10/20 mW                            |
| `*BATT_BARS`                                                         | 0–5; `255` = Unknown                                                   |
| `*BATT_CHARGE`, `*BATT_HEALTH`                                       | `%`; `255` = Unknown                                                   |
| `*BATT_CYCLE`                                                        | Ciclos; `65535` = Unknown                                              |
| `TX_BATT_MINS` / `BATT_RUN_TIME`                                     | minutos → `h:mm` (`65535` Unknown, `65534` Calculating, `65533` Error) |
| `*BATT_TEMP_C` / `*BATT_TEMP_F`                                      | valor + 40; `255` = Unknown                                            |
| `*BATT_TYPE`                                                         | `ALKA`, `LION`, `LITH`, `NIMH`, `UNKN`                                 |

Slot do AD (`REP <ch> SLOT_<PARÂMETRO> <slot> <valor>`): `SLOT_STATUS`, `SLOT_SHOWLINK_STATUS`, `SLOT_TX_MODEL`, `SLOT_TX_DEVICE_ID`, `SLOT_OFFSET`, `SLOT_INPUT_PAD`, `SLOT_RF_POWER`, `SLOT_RF_POWER_MODE`, `SLOT_POLARITY`, `SLOT_RF_OUTPUT`, `SLOT_BATT_BARS`, `SLOT_BATT_CHARGE_PERCENT`, `SLOT_BATT_CYCLE_COUNT`, `SLOT_BATT_HEALTH_PERCENT`, `SLOT_BATT_MINS`, `SLOT_BATT_TYPE`.

Receptor (`REP <PARÂMETRO> <valor>`): `FW_VER`, `DEVICE_ID`, `MODEL`, `RF_BAND`, `LOCK_STATUS`, `ENCRYPTION`, `HIGH_DENSITY` / `TRANSMISSION_MODE`, `QUADVERSITY_MODE`, `FREQUENCY_DIVERSITY_MODE`, `AUDIO_SUMMING_MODE`, `FLASH`.

## 6. Funcionalidades e regras

### Conexão e heartbeat (`src/index.js`)

- Ao conectar, o módulo pede o estado completo (`GET 0 ALL`) e, com metering habilitado, define o intervalo de amostras.
- A cada 30 s envia `GET 1 METER_RATE`. Cada resposta com `METER_RATE` reinicia um timeout de 60 s; se não houver resposta nesse período, a conexão é refeita.
- Mudar o **Target IP** recria a conexão.

### Ícones do status (`src/icons.js`, `src/internalAPI.js`)

- O feedback `sample` gera um buffer ARGB do tamanho do botão e o envia como `imageBuffer` com `imageBufferEncoding: ARGB` e `imageBufferPosition`, formato aceito pelo Companion v3 a v5.
- Os ícones são cacheados por combinação de estado e tamanho do botão.
- Com **labels**, o feedback define o texto (fonte 7, alinhado ao topo à esquerda). **Sem labels**, devolve só a imagem e mantém o texto do próprio botão, o que permite combinar ícones com qualquer texto.
- No Companion v5, o botão precisa da camada **Image Buffers** para exibir os ícones. Ela é criada automaticamente ao arrastar um preset do módulo; em botões montados manualmente pode não existir.

### Faixas dos medidores (SLX)

RF (`rf_level` = valor − 120, em dBm):

| Pontos | Faixa         |
| :----: | ------------- |
|   5    | ≥ −25 dBm     |
|   4    | −70 a −26 dBm |
|   3    | −77 a −71 dBm |
|   2    | −83 a −78 dBm |
|   1    | −90 a −84 dBm |
|   0    | < −90 dBm     |

Áudio (`audio_level` = valor − 120, em dBFS):

| Pontos | Faixa          |
| :----: | -------------- |
|   6    | ≥ −6 dBFS      |
|   5    | −12 a −7 dBFS  |
|   4    | −20 a −13 dBFS |
|   3    | −30 a −21 dBFS |
|   2    | −40 a −31 dBFS |
|   1    | −49 a −41 dBFS |
|   0    | ≤ −50 dBFS     |

No ULX/QLX o receptor já informa os pontos; no AD cada ponto vem de um bitmap.

### Bateria

- `battery_bars` de 0 a 5; `255` significa desconhecido (transmissor desligado ou sem dados).
- O ícone fica vermelho quando as barras ficam ≤ **Battery Alert Level** (padrão 2).
- `battery_runtime`: `65535` = Unknown, `65534` = Calculating, `65533` = Error; demais valores em `h:mm`.

### Ganho

O receptor trabalha com `0–60` e o módulo converte para `−18 a +42 dB` (offset de 18).

### Upgrade de configurações antigas

`src/upgrades.js` converte os feedbacks legados (`battery_level`, `channel_muted`, `transmitter_muted`, `interference_status`, `channel_frequency`, `channel_gain`, `transmitter_turned_off` e os `slot_*`) em feedbacks boolean, preservando botões criados em versões anteriores do Companion.

### Cores padrão dos alertas

| Situação                                 | Texto  | Fundo                     |
| ---------------------------------------- | ------ | ------------------------- |
| Bateria baixa                            | branco | vermelho `#FF0000`        |
| TX desligado / sem dados                 | branco | azul `#000080`            |
| Canal ou transmissor mutado              | branco | vermelho escuro `#800000` |
| Interferência                            | branco | vermelho `#FF0000`        |
| Frequência / ganho / slot igual ao valor | preto  | amarelo `#FFFF00`         |
| RF / potência do slot igual ao valor     | branco | verde `#64FF00`           |

## 7. Logging e trace

- Logs no **Log** da conexão no Companion, via `this.log`:
  - `error`: `Network error: <mensagem>` (falhas de socket)
  - `debug`: `Connected`, `Socket not connected :(` (comando enviado sem conexão), `Shure Model: <id> NOT FOUND` (modelo inválido na config)
- Status da conexão (indicador no botão e na lista de conexões):
  - `Connecting` / estados do socket TCP, repassados do `TCPHelper`
  - `BadConfig` com `controlId → actionId → opção` quando o valor de uma action não passa na validação
- Não há correlationId: para rastrear uma execução, use o log da conexão junto com a saída do simulador, que imprime cada comando recebido (`<- SET 1 AUDIO_GAIN INC 3`).
- Valores brutos recebidos ficam visíveis nas variáveis da conexão (aba **Variables**), úteis para conferir as faixas dos medidores.

## 8. Testes

Não há suíte automatizada (`yarn test` não está configurado). A validação é manual, com receptor real ou com o simulador.

### Simulador de SLXD (`tools/slxd-simulator.mjs`)

Servidor TCP que imita um receptor Shure SLXD. Permite testar presets, ícones, variáveis e actions sem os microfones. Não tem dependências além do Node.js e não entra no pacote do módulo.

#### Iniciar

Na raiz do projeto, na mesma máquina do Companion (ou em outra máquina da rede):

```bash
node tools/slxd-simulator.mjs [canais] [porta]
```

| Argumento | Padrão | Descrição                                              |
| --------- | ------ | ------------------------------------------------------ |
| `canais`  | `2`    | Número de canais simulados (`1` = SLXD4, `2` = SLXD4D) |
| `porta`   | `2202` | Porta TCP em que o simulador escuta                    |

Exemplos:

```bash
node tools/slxd-simulator.mjs          # SLXD4D na porta 2202
node tools/slxd-simulator.mjs 1        # SLXD4 na porta 2202
node tools/slxd-simulator.mjs 2 2300   # SLXD4D na porta 2300
```

Saída ao iniciar:

```
SLXD simulado (2 canais) em 0.0.0.0:2202
```

#### Configurar a conexão no Companion

| Campo             | Valor                                                                  |
| ----------------- | ---------------------------------------------------------------------- |
| Target IP         | `127.0.0.1` (ou o IP da máquina onde o simulador roda)                 |
| Target Port       | a porta do simulador (`2202`)                                          |
| Model Type        | `SLXD4D Dual Receiver` (2 canais) ou `SLXD4 Single Receiver` (1 canal) |
| Enable Metering?  | ligado                                                                 |
| Metering Interval | `500` para medidores mais dinâmicos                                    |

Ao salvar, o terminal do simulador mostra a conexão e os comandos recebidos:

```
Companion conectado ::ffff:127.0.0.1
<- GET 0 ALL
<- SET 0 METER_RATE 500
```

#### Dados simulados

Estado inicial por canal (`N` = número do canal):

| Parâmetro       | Valor                     | Exibição no Companion |
| --------------- | ------------------------- | --------------------- |
| `CHAN_NAME`     | `{Shure N}`               | `Shure N`             |
| `FREQUENCY`     | `471125` + 1000 por canal | `471.125`, `472.125`… |
| `GROUP_CHANNEL` | `{1,N+1}`                 | `1,2`, `1,3`…         |
| `AUDIO_GAIN`    | `014`                     | `-4 dB`               |
| `TX_TYPE`       | `SLXD2`                   | `SLXD2`               |
| `TX_BATT_BARS`  | `004`                     | 4 barras              |
| `TX_BATT_MINS`  | `00300`                   | `5:00`                |

Amostras (`SAMPLE`), enviadas no intervalo pedido em `SET METER_RATE`:

- RF aleatório entre −30 e −90 dBm, passando por todas as faixas do ícone de RF;
- áudio RMS aleatório entre 0 e −50 dBFS, com pico 6 dB acima.

#### Comandos suportados

| Comando recebido               | Resposta                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------- |
| `GET 0 ALL`                    | `REP MODEL {SLXD4D}` e todos os parâmetros de cada canal                                        |
| `SET 0 METER_RATE <ms>`        | `REP 1 METER_RATE <ms>` e inicia/para o envio de `SAMPLE` (`0` para)                            |
| `GET 1 METER_RATE`             | `REP 1 METER_RATE 05000` (heartbeat do módulo)                                                  |
| `SET <ch> <PARÂMETRO> <valor>` | Atualiza o estado e responde `REP <ch> <PARÂMETRO> <valor>`, para os parâmetros da tabela acima |

`SET <ch> AUDIO_GAIN INC/DEC <dB>` soma ou subtrai do ganho atual (limitado a 0–60, ou seja −18 a +42 dB) e responde com o novo valor. Os demais comandos (ex.: `FLASH`) aparecem no terminal, mas não alteram o estado simulado.

#### Parar

`Ctrl+C` no terminal do simulador. A conexão no Companion passa para erro e tenta reconectar sozinha.

#### Problemas comuns

| Sintoma                                                 | Causa / solução                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Error: listen EADDRINUSE`                              | Porta ocupada: outro simulador rodando ou outro processo. Pare o processo (`lsof -iTCP:2202 -sTCP:LISTEN`) ou use outra porta. |
| Conexão não aparece no terminal                         | IP/porta da conexão diferentes do simulador, ou firewall bloqueando (quando em outra máquina).                                 |
| Botões sem ícones de RF/áudio mudando                   | Metering desligado na conexão ou intervalo muito alto.                                                                         |
| Medidores com valores trocados (áudio alto em silêncio) | Model Type diferente de SLXD na conexão.                                                                                       |
| Botão azul                                              | TX sem dados: o simulador não está conectado ou ainda não respondeu.                                                           |

### Roteiro de teste

1. Inicie o simulador e configure a conexão como acima.
2. Na aba **Presets**, arraste um botão de cada categoria (Status, Status Full, Gain, Battery, Meter, Identify).
3. Confira:
   - **Status / Status Full:** fundo preto, nome `Shure 1`, frequência, grupo/canal, ganho e ícones variando.
   - **Gain:** ao pressionar `+3`, o terminal mostra `<- SET 1 AUDIO_GAIN INC 3` e o ganho no botão passa de `-4 dB` para `-1 dB`; `Gain 0 dB` fica amarelo ao chegar em 0.
   - **Battery:** `5:00` e 4 barras.
   - **Meter:** RF em dBm e áudio em dBFS mudando a cada amostra.
4. Pare o simulador e confirme que os botões de Status ficam azuis (TX sem dados).

### Formatação

```bash
yarn format
```

## 9. Variáveis de ambiente

O módulo não usa variáveis de ambiente. A configuração é feita na conexão do Companion:

| Campo                     | ID                 | Padrão  | Descrição                                                                     |
| ------------------------- | ------------------ | ------- | ----------------------------------------------------------------------------- |
| Target IP                 | `host`             | —       | IP do receptor                                                                |
| Target Port               | `port`             | `2202`  | Porta TCP do receptor                                                         |
| Model Type                | `modelID`          | `ulxd4` | Modelo do receptor; define família, canais e slots                            |
| Enable Metering?          | `meteringOn`       | `true`  | Habilita o envio de amostras (`SAMPLE`)                                       |
| Metering Interval (in ms) | `meteringInterval` | `5000`  | Intervalo das amostras (50–99999 ms); valores muito baixos podem travar a GUI |
| Variable Format           | `variableFormat`   | `units` | `units` inclui unidades nas variáveis; `numeric` só o número                  |

## Licença

MIT. Veja [LICENSE](LICENSE).
