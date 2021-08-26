#!node

const _ = require('lodash');
const YAML = require('yaml');
const fs = require('fs');
const got = require('got');
const { Command } = require('commander');
const { exec } = require('child_process');

const program = new Command();
program.option('--initial', 'is this an initial creation');
program.requiredOption('--group <group>', 'the group which should be allowed access to the lockout');
program.option('--url <url>', 'the base URL of CiviCRM', 'https://archreactor.org/sites/all/modules/civicrm/extern/rest.php');
program.requiredOption('--key <key>');
program.requiredOption('--apiKey <apiKey>');
program.requiredOption('--name <name>');
program.requiredOption('--activeTime <activeTime>');
program.requiredOption('--wifiName <wifiName>');
program.requiredOption('--wifiPass <wifiPass>');
program.requiredOption('--esphome <esphome>');
program.requiredOption('--ip <ip>');

program.parse();

const initial = program.opts().initial;
const url = program.opts().url;
const key = program.opts().key;
const apiKey = program.opts().apiKey;
const group = program.opts().group;
const name = program.opts().name;
const activeTime = parseInt(program.opts().activeTime, 10);
const wifiName = program.opts().wifiName;
const wifiPass = program.opts().wifiPass;
const esphome = program.opts().esphome;
const ip = program.opts().ip;

async function getPageOfGroupMembers(url, apiKey, group, limit, offset) {
    const searchParams = new URLSearchParams([
        ['key', key],
        ['api_key', apiKey],
        ['entity', 'Contact'],
        ['action', 'get'],
        ['json', '1'],
        ['json', JSON.stringify({
            sequential: 1,
            group,
            return: "id,email,display_name,custom_12",
            options: {
                sort: "sort_name ASC",
                limit,
                offset,
            },
        }),
        ],
    ]);

    const response = await got(`${url}`, { searchParams }).json();

    return response.values
        .map((val) => {
            const name = val.display_name;
            const email = val.email;
            const cards = val.custom_12.split(',').filter((card) => card.length > 0);

            if (cards.length === 0) {
                console.error(`no cards found for ${name} - ${email}`);
            }

            return cards.map((card) => ({ name, email, card }))
        })
        .flat();
}

async function getGroupMembers(url, apiKey, group) {
    const limit = 10;

    const results = [];

    const getNextPage = async (offset = 0) => {
        const page = await getPageOfGroupMembers(url, apiKey, group, limit, offset);

        if (page.length === 0) return;

        results.push(...page);

        await getNextPage(offset + limit);
    };

    await getNextPage();

    return results;
}

function setGlobal(template, name, value) {
	let found = false;
	template.globals.forEach((global) => {
		if (global.id === name) {
			found = true;

			if (_.isNumber(value)) {
				global.initial_value = `${value}`;
			} else if (_.isString(value)) {
				global.initial_value = `"${value}"`;
			} else if (_.isArray(value)) {
				global.initial_value = `{ ${value.map((v) => `"${v}"`).join(', ')} }`;
			} else {
				throw new Error('invalid global value type');
			}
		}
	});

	if (!found) {
		throw new Error(`global ${name} not found`);
	}
}

Promise.resolve()
.then(async () => {
	const templateFile = fs.readFileSync('../template/template.yaml', { encoding: 'utf-8' });
	const template = YAML.parse(templateFile);

	template.esphome.name = `lockout-${name}`;
	template.wifi.ssid = wifiName;
	template.wifi.password = wifiPass;
	template.wifi.use_address = ip;
	template.wifi.ap.ssid = `lockout-${name}-fallback`;
	template.wifi.ap.password = wifiPass;

	setGlobal(template, 'lockout_name', name);
	setGlobal(template, 'active_time', activeTime);

	const members = await getGroupMembers(url, apiKey, group);

	const cards = members.map((m) => m.card);
	const names = members.map((m) => m.name);

	setGlobal(template, 'allowed_card_ids', cards);
	setGlobal(template, 'allowed_names', names);

	const filename = `../build/${name}.yaml`;
	fs.writeFileSync(filename, YAML.stringify(template));

	if (initial) {
		console.log(`config file has been written to ${filename}, run the following to load via USB:`);
		console.log(`sudo docker run --rm -v "\${PWD}/../build":/config -it --device /dev/ttyUSB0 esphome logs ${name}.yaml`);
	} else {
		console.log('attempting to update lockout');
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(
				() => reject(new Error('timeout attempting to update')),
				60 * 1000
			);

			exec(
				`docker run \
					--rm \
					-v "${__dirname}/../build":/config \
					${esphome} run --no-logs ${name}.yaml
				`,
				(err) => {
					clearTimeout(timeout);

					if (err) reject(err);
					else resolve();
				}
			);
		});
		console.log('lockout updated');
	}
})
.catch((err) => {
	console.log('Error:');
    console.dir(err);
    process.exit(1);
});

