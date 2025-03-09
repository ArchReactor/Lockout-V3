#!node

const _ = require('lodash');
const YAML = require('yaml');
const fs = require('fs');
const got = require('got');
const { Command } = require('commander');
const { spawn } = require('child_process');
const path = require('path');

const program = new Command();
program.option('--initial', 'is this an initial creation, only write out template, do not do OTA');
program.requiredOption('--group <group>', 'the group which should be allowed access to the lockout');
program.option('--url <url>', 'the base URL of the website', 'https://archreactor.org');
program.option('--path <path>', 'the path of the CiviCRM v4 API', '/civicrm/ajax/api4');
program.requiredOption('--key <key>', 'the CiviCRM key');
program.requiredOption('--apiKey <apiKey>', 'the CiviCRM API key');
program.requiredOption('--espKey <espKey>', 'the ESPHome API key');
program.requiredOption('--name <name>', 'the name of the lockout');
program.requiredOption('--activeTime <activeTime>', 'the time the lockout should be active after a valid swipe');
program.requiredOption('--wifiName <wifiName>');
program.requiredOption('--wifiPass <wifiPass>');
program.requiredOption('--ip <ip>', 'the IP address that should be used to OTA update the lockout');
program.requiredOption('--gateway <gateway>', 'the IP address that should be used for the lockout\'s gateway');
program.requiredOption('--subnet <subnet>', 'the IP address subnet');
program.requiredOption('--dns <dns>', 'the dns server to use');
program.option('--pin <pin>', 'the pin to switch on and off');
program.option('--template <template>', 'the pin to switch on and off');
program.option('--output <output>', 'the dir to write the finished template out to, defaults to build');

program.parse();

const initial = program.opts().initial;
const url = program.opts().url;
const apipath = program.opts().path;
const key = program.opts().key;
const apiKey = program.opts().apiKey;
const espKey = program.opts().espKey;
const groupsString = program.opts().group;
const name = program.opts().name;
const activeTime = parseInt(program.opts().activeTime, 10);
const wifiName = program.opts().wifiName;
const wifiPass = program.opts().wifiPass;
const ip = program.opts().ip;
const gateway = program.opts().gateway;
const subnet = program.opts().subnet;
const dns = program.opts().dns;
const pin = program.opts().pin || 'D0';
const templateInput = program.opts().template || 'template.yaml';
const outputDir = program.opts().output || '../build';

const civicAPI = civicrm({
  server: url,
  path: apipath,
  api_key: apiKey,
  key: key,
});

console.log(`fetching members for groups ${groups}`);

civicAPI.get('Contact', {
  select: ['id', 'email_primary.email', 'display_name', 'Card_ID.new_card_id'],
  where: [['Card_ID.new_card_id', 'IS NOT EMPTY'], ['groups', 'IN', groups.split(',')]],
  orderBy: { display_name: 'ASC' },
}).then((res) => {
  let members = res.values.map((val) => {
    const id = val.id
    const name = val.display_name;
    const email = val['email_primary.email'];
    const cards = val['Card_ID.new_card_id'].split(',')
      .filter((card) => card.length > 0)
      .map((cardId) => cardId.toLowerCase());

    if (cards.length === 0) {
      console.error(`no cards found for ${name} - ${email}`);
    }

    return cards.map((card) => ({ id, name, email, card }));
  })
  .flat();

  const allowedCards = `{${members.map((m) => `"${m.card}"`).join(',')}}`;
  const allowedNames = `{${members.map((m) => `"${m.name}"`).join(',')}}`;
  const allowedIds = `{${members.map((m) => `"${m.id}"`).join(',')}}`;

  try {
    console.log('reading template');

    const templateFile = fs.readFileSync(`./template/${templateInput}`, { encoding: 'utf-8' });

    console.log(`building config for ${name}`);

    const substitutions = {
      name: `lockout-${name}`,
      wifiName,
      wifiPass,
      ip,
      gateway,
      subnet,
      dns,
      espKey,
      fallbackWifiName: `lockout-${name}-fallback`,
      fallbackWifiPass: wifiPass,
      pin,
      activeTime: `${activeTime}`,
      allowedCards,
      allowedNames,
      allowedIds,
    }

    const substitutionsStr = YAML.stringify({ substitutions });
    const renderedTemplate = `${substitutionsStr}\n\n${templateFile}`;

    const filename = path.resolve(outputDir, `${name}.yaml`);

    console.log(`writing template file ${filename}`);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(filename, renderedTemplate);
    fs.copyFileSync('./template/Hack-Regular.ttf', path.resolve(outputDir, 'Hack-Regular.ttf'));
    //  fs.copyFileSync('./template/esp32_wdt.h', path.resolve(outputDir, 'esp32_wdt.h'));
    const wiegandDir = path.resolve(outputDir, 'components', 'wiegand_reader');
    fs.mkdirSync(wiegandDir, { recursive: true });
    fs.copyFileSync('./template/components/wiegand_reader/__init__.py', path.resolve(wiegandDir, '__init__.py'));
    fs.copyFileSync('./template/components/wiegand_reader/wiegand_reader.h', path.resolve(wiegandDir, 'wiegand_reader.h'));
    fs.copyFileSync('./template/components/wiegand_reader/wiegand_reader.cpp', path.resolve(wiegandDir, 'wiegand_reader.cpp'));

    if (initial) {
      console.log(`config file has been written to ${filename}, run the following to load via USB:`);
      console.log(`esphome run ${name}.yaml`);
    } else {
      console.log('attempting to update lockout');
      const timeout = setTimeout(
        () => reject(new Error('timeout attempting to update')),
        300 * 1000
      );

      const esp = spawn('esphome', ['run', '--no-logs', filename], { timeout: 300 * 1000 });// 5 minutes

      esp.stdout.on('data', (data) => {
        let msg = data;
        //console.log(data.toString());
      });

      esp.stderr.on('data', (data) => {
        let msg = data.toString().trim();
        if (msg.includes('ERROR')) {
          console.log('Error:' + msg);
          process.exit(1);
        } else {
          console.log(msg);
        }
      });

      esp.on('close', (code) => {
        if (code == 0) {
          console.log('lockout updated');
        } else {
          console.log(`ESPHome exited with code ${code}`);
        }
        console.log(" ");
        process.exit(code);
      });

    }
  } catch (err) {
    console.log('Error:');
    console.dir(err);
    process.exit(1);

  }
}).catch((err) => {
  console.log('Error:');
  console.dir(err);
  process.exit(1);
});
