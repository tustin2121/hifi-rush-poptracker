#! node

const fs = require('fs/promises');
const fsSync = require("fs");
const PATH = require('path');
const yaml = require('./js-yaml-mod'); // require('js-yaml');
const archiver = require('archiver');
const semver = require('semver');
const { Command } = require('commander');

//-----------------------------------------------------------------------------
//#region YAML Parsing

const COMMON_KEY = `$common`;
const CHILDREN_KEY = `$for`;
function flattenArray(array, common={}) {
	const outList = [];
	for (const item of array) {
		if (typeof item[COMMON_KEY] === 'object' && Array.isArray(item[CHILDREN_KEY])) {
			for (const i2 of flattenArray(item[CHILDREN_KEY], item[COMMON_KEY])) {
				outList.push(mergeWith(i2, common, mergeCustom));
			}
		} else {
			outList.push(mergeWith({}, item, common, mergeCustom));
		}
	}
	return outList;
	
	function mergeCustom(ov, sv, key) {
		if (key === "name" && typeof ov === 'string' && typeof sv === 'string') {
			return sv + ov;
		}
	}
}
/**
 * 
 * @param {string} str - Input string
 * @returns {object}
 */
function parseYaml(str) {
	let mode = 'direct';
	let $schema;
	
	let json = yaml.loadAll(str, {
		onUnknownDirective: (dir, args)=>{
			if (dir === "SCHEMA") $schema = args[0];
			if (dir === "OUTPUT") mode = args[0];
		}
	});
	switch (mode) {
		case 'flatten':
			if (json.length !== 1) throw new TypeError("OUTPUT direct documents must only have 1 yaml document in them.");
			return flattenArray(json[0]);
		case 'direct':
			if (json.length !== 1) throw new TypeError("OUTPUT direct documents must only have 1 yaml document in them.");
			json = json[0];
			if ($schema) {
				if (Array.isArray(json)) {
					json = { data: json };
				}
				json['$schema'] = $schema;
			}
			return json;
		default:
			return json;
			
	}
}

//#endregion
//-----------------------------------------------------------------------------

const program = new Command();
program
	.argument('[outPath]', 'Output path for the final archive')
	.option('-b, --build-dir <path>', 'Path to place intermediate build files', '.build')
	.option('--no-archive', 'Do not create final archive file')
;


const YAML_FILE_LIST = [
	`versions.yml`,
	`manifest.yml`,
];

program.action(async function main() 
{
	const jobs = [];
	const packageInfo = JSON.parse(await fs.readFile(`package.json`, { encoding:'utf8' }));
	
	const outFile = PATH.resolve(program.args[0] ?? `out/${packageInfo.name}.v${semver.major(packageInfo.version)}.${semver.minor(packageInfo.version)}.zip`);
	await fs.mkdir(program.opts().buildDir, { recursive:true });
	
	for (const file of YAML_FILE_LIST) {
		const str = await fs.readFile(`src/${file}`, { encoding:'utf8' });
		const data = parseYaml(str);
		if (file === 'manifest.yml') {
			data['package_version'] = packageInfo.version;
			data['author'] = packageInfo.author;
		}
		jobs.push(fs.writeFile(`${program.opts().buildDir}/${file.replace('.yml', '.json')}`, JSON.stringify(data, undefined, '\t')));
	}
	
	
	
	await Promise.all(jobs);
	
	if (program.opts().archive) {
		await fs.mkdir(PATH.dirname(outFile), { recursive:true });
		const out = fsSync.createWriteStream(outFile);
		const zip = archiver('zip', { zlib: { level: 9 } });
		
		zip.on('close', ()=>{
			console.log(`APWorld archive (${zip.pointer()} bytes) written to ${out.path}`);
		});
		zip.on('warning', (err)=> console.error('Warning archiving data:', err));
		zip.pipe(out);
		
		zip.directory('out/', false);
		await zip.finalize();
	}
	console.log('Build complete.');
});
program.parseAsync();