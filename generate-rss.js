import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.resolve('./data.json');
const OUTPUT_FILE = path.resolve('./public/feed.xml');

async function main() {
  console.log('Reading data.json...');
  let data = { title: "Friendly Podcast For You", episodes: {} };
  if (fs.existsSync(DATA_FILE)) {
    data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }

  const targetRssUrl = data.sourceRss || 'https://anchor.fm/s/1110f80e0/podcast/rss';
  console.log(`Fetching Anchor RSS feed from ${targetRssUrl}...`);
  const res = await fetch(targetRssUrl);
  const xmlData = await res.text();

  console.log('Parsing XML...');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    cdataPropName: "__cdata",
    format: true,
    processEntities: {
      enabled: true,
      maxTotalExpansions: 50000,
      maxEntityCount: 10000,
    }
  });
  
  let jObj = parser.parse(xmlData);



  // Update Title
  if (data.title && jObj.rss && jObj.rss.channel) {
    console.log(`Updating title to: ${data.title}`);
    jObj.rss.channel.title = data.title;
  }

  // Update Links for each episode
  if (jObj.rss && jObj.rss.channel && jObj.rss.channel.item) {
    let items = Array.isArray(jObj.rss.channel.item) ? jObj.rss.channel.item : [jObj.rss.channel.item];
    data.hiddenEpisodes = data.hiddenEpisodes || [];
    
    // Filter out hidden episodes
    items = items.filter(item => {
      let guidStr = item.guid;
      if (typeof item.guid === 'object' && item.guid['#text']) {
         guidStr = item.guid['#text'];
      }
      return !data.hiddenEpisodes.includes(guidStr);
    });
    
    let updatedCount = 0;
    for (let item of items) {
      let guidStr = item.guid;
      if (typeof item.guid === 'object' && item.guid['#text']) {
         guidStr = item.guid['#text'];
      }
      
      if (guidStr && data.episodes && data.episodes[guidStr]) {
        item.link = data.episodes[guidStr];
        updatedCount++;
      }
    }
    
    // Re-assign the filtered and updated items back to the channel
    jObj.rss.channel.item = items;
    console.log(`Updated ${updatedCount} episode links. Removed ${data.hiddenEpisodes.length} hidden episodes.`);
  }

  console.log('Building new XML...');
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    cdataPropName: "__cdata",
    format: true,
    suppressEmptyNode: true
  });
  
  const modifiedXml = builder.build(jObj);

  // Ensure public dir exists
  if (!fs.existsSync(path.dirname(OUTPUT_FILE))) {
    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  }

  console.log('Writing feed.xml...');
  const finalXml = modifiedXml.startsWith('<?xml') ? modifiedXml : '<?xml version="1.0" encoding="UTF-8"?>\n' + modifiedXml;
  fs.writeFileSync(OUTPUT_FILE, finalXml);
  console.log('Done!');
}

main().catch(err => {
  console.error("Error generating RSS:", err);
  process.exit(1);
});
