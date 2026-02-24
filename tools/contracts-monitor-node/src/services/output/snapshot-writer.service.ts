import {
    mkdir,
    writeFile,
} from 'node:fs/promises';

import { dirname } from 'node:path';
import type { MonitorSnapshot } from '../../types/monitor.types.js';

// ========== ЗАПИСЬ СНАПШОТА ==========
export class SnapshotWriterService {
    constructor(
        private readonly outputFilePath: string
    ) {}

    async write(snapshot: MonitorSnapshot): Promise<void> {
        await mkdir(
            dirname(this.outputFilePath),
            { recursive: true }
        );

        await writeFile(
            this.outputFilePath,
            JSON.stringify(snapshot, null, 2),
            'utf8'
        );
    }
}
