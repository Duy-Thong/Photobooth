import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'src', 'lib', 'frames-static.ts');

async function updateLayouts() {
  const content = fs.readFileSync(filePath, 'utf8');
  
  const startIndex = content.indexOf('STATIC_FRAMES: FrameItem[] = [');
  if (startIndex === -1) {
    console.error("Could not find STATIC_FRAMES starting point");
    process.exit(1);
  }
  
  const openingBracketIndex = content.indexOf('[', startIndex);
  const closingBracketIndex = content.lastIndexOf(']');
  
  if (openingBracketIndex === -1 || closingBracketIndex === -1) {
    console.error("Could not find brackets");
    process.exit(1);
  }

  const arrayStr = content.substring(openingBracketIndex, closingBracketIndex + 1);
  const context = { STATIC_FRAMES: null };
  vm.createContext(context);
  try {
    vm.runInContext(`STATIC_FRAMES = ${arrayStr}`, context);
  } catch (e) {
    console.error("Error parsing array:", e);
    process.exit(1);
  }
  
  const frames = context.STATIC_FRAMES;

  const updatedFrames = frames.map(frame => {
    // Detect layout based on unique X coordinates
    const slotsData = frame.slots_data || [];
    if (slotsData.length === 0) {
      return { ...frame, layout: `${frame.slots}x1` };
    }

    const xs = slotsData.map(s => Math.round(s.x / 10) * 10).sort((a, b) => a - b);
    const uniqueXs = [...new Set(xs)];
    const uniqueXGroups = [];
    uniqueXs.forEach(x => {
      if (uniqueXGroups.length === 0 || x - uniqueXGroups[uniqueXGroups.length - 1] > 40) {
        uniqueXGroups.push(x);
      }
    });

    const cols = uniqueXGroups.length;
    const slots = frame.slots;
    const rows = Math.ceil(slots / cols);
    
    return {
      ...frame,
      layout: `${cols}x${rows}`
    };
  });

  const header = content.substring(0, openingBracketIndex);
  const footer = content.substring(closingBracketIndex + 1);
  
  const newArrayStr = JSON.stringify(updatedFrames, null, 2);
  const newContent = `${header}${newArrayStr}${footer}`;
  
  fs.writeFileSync(filePath, newContent);
  console.log('Successfully updated layouts for', updatedFrames.length, 'frames.');
}

updateLayouts().catch(console.error);
