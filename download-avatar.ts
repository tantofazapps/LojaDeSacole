import fs from 'fs';
import https from 'https';
import path from 'path';

const url = "https://image.pollinations.ai/prompt/A%20friendly%20portrait%20avatar%20of%20a%20smiling%2060-year-old%20Black%20woman%20with%20dark%20hair%20tied%20back%2C%20wearing%20sunglasses%20and%20a%20black%20high-neck%20shirt.%20She%20is%20standing%20in%20front%20of%20a%20vibrant%2C%20cheerful%20background%20themed%20around%20sacoles%20%28Brazilian%20popsicles%29%20with%20bright%20orange%2C%20pink%2C%20and%20yellow%20colors%2C%20and%20cute%20subtle%20popsicle%20patterns.%20High%20quality%2C%20welcoming%2C%20perfect%20for%20a%20small%20business%20store%20profile%20picture%2C%20centered%2C%20well-lit%2C%20digital%20art%20style.?width=512&height=512&nologo=true";

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

const file = fs.createWriteStream(path.join(publicDir, 'avatar-dineia.png'));
https.get(url, function(response) {
  response.pipe(file);
  file.on('finish', function() {
    file.close();
    console.log("Image downloaded successfully!");
  });
}).on('error', function(err) {
  fs.unlink(path.join(publicDir, 'avatar-dineia.png'), () => {});
  console.error("Error downloading image:", err.message);
});
