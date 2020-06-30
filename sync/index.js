function Google({ CONTAINER_GOOGLE_PK, CONTAINER_GOOGLE_PK_ID, googleApi, utils }){
	
	let auth;
	let drive;
	const lineBreaks = new RegExp(/\\n/,"g");
	const googleFiles = [];

	this.initialise = async()=>{
		lineBreaks.lastIndex = 0;
		const credentials = {
			"type": "service_account",
			"project_id": "api-project-927120566382",
			"private_key": `${CONTAINER_GOOGLE_PK}`,
			"private_key_id": `${CONTAINER_GOOGLE_PK_ID}`,
			"client_email": "ragetoast@api-project-927120566382.iam.gserviceaccount.com",
			"client_id": "114577838289102656997",
			"auth_uri": "https://accounts.google.com/o/oauth2/auth",
			"token_uri": "https://oauth2.googleapis.com/token",
			"auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
			"client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/ragetoast%40api-project-927120566382.iam.gserviceaccount.com"
		};
		credentials.private_key = credentials.private_key.replace(lineBreaks,"\n")
		auth = new googleApi.auth.JWT(credentials.client_email, null, credentials.private_key, ['https://www.googleapis.com/auth/drive','https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive.metadata']);
		auth.authorize();
		drive = googleApi.drive({ version: 'v3', auth });
	};

	let index = 0;
	setInterval(async() => {
		let targetFile = googleFiles[index];
		if (targetFile){
			const snapshotJSON = JSON.stringify(targetFile.data);
			const snapshot = JSON.parse(snapshotJSON);
			if (utils.sizeOf(snapshot) !== utils.sizeOf(targetFile.originalData)){
				utils.log("GOOGLE",`saving ${targetFile.id}`);
				let media = { mimeType: "application/json", body: snapshotJSON };
				await drive.files.create({ auth, resource: {name: targetFile.id, mimeType: 'application/json'}, media, fields: 'id' });
				await targetFile.callbacks.forEach(async func => await func());
				targetFile.originalData = snapshot;
			}
			index = index + 1;
		} else {
			index = 0;
		}
	},2000);

	this.loadFile = async (id) => {
		let file = googleFiles.find(x => x.id === id);
		if (file){
			return file;
		} else {
			file = {
				id, 
				data: null,
				originalData: {},
				callbacks: [],
				onFileChange: (callback) => {
					file.callbacks.push(callback);
				}
			};
			const res = await drive.files.list({
				auth: auth,
				q: "'root' in parents",
				fields: "files(id, name, mimeType)"
			});
			const metadata = res.data.files.find(x=>x.name === id);
			if (metadata) {
				console.log("Metadata Found: ", metadata);
				let data = await drive.files.get({ fileId: metadata.id, alt: 'media'});
				if (data) {
					const dataStr = JSON.stringify(data);
					if (!dataStr) {
						throw new Error(`failed to parse ${id} to json string.`);
					}

					const dateFormat = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$/;
					data = JSON.parse(dataStr, (key, value) => {
					  if (typeof value === "string" && dateFormat.test(value)) {
					    return new Date(value);
					  }
					  return value;
					});

					if (!data) {
						throw new Error(`failed to parse ${id} to an object with valid dates.`);
					}
					file.data = data;
					utils.log("GOOGLE", `file for ${id} was loaded from google drive.`);
				} else {
					utils.log("GOOGLE", `new file ${id} was created on google drive.`);
					file.data = null;
				}
			}
			googleFiles.push(file);
			return file;
		}
	}
}

const utils = require("utils");
const google= new Google({ 
    CONTAINER_GOOGLE_PK: process.env.CONTAINER_GOOGLE_PK, 
    CONTAINER_GOOGLE_PK_ID: process.env.CONTAINER_GOOGLE_PK_ID, 
    googleApi: require("googleapis"),
    utils
});

google.initialise();

module.exports = async function (context, req) {
    context.log('JavaScript HTTP trigger function processed a request.');

    const name = (req.query.name || (req.body && req.body.name));
    const responseMessage = name
        ? "Hello, " + name + ". This HTTP triggered function executed successfully."
        : "This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.";

    context.res = {
        // status: 200, /* Defaults to 200 */
        body: responseMessage
    };
}