#! node

const fs = require('fs/promises');
const fsSync = require("fs");
const PATH = require('path');
const yaml = require('./js-yaml-mod'); // require('js-yaml');
const archiver = require('archiver');
const semver = require('semver');

const YAML_FILE_LIST = [
	`versions.yml`,
	`manifest.yml`,
];

async function main() {
	const jobs = [];
	const packageInfo = JSON.parse(await fs.readFile(`package.json`, { encoding:'utf8' }));
	
	for (const file of YAML_FILE_LIST) {
		const str = await fs.readFile(`src/${file}`, { encoding:'utf8' });
		const data = yaml.load(str);
		if (file === 'manifest.yml') {
			data['package_version'] = packageInfo.version;
			data['author'] = packageInfo.author;
		}
		jobs.push(fs.writeFile(file.replace('.yml', '.json'), JSON.stringify(data, undefined, '\t')));
	}
	
	
	
	await Promise.all(jobs);
}
main();
