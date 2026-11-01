const https = require('https');
const fs = require('fs');

const options = {
    hostname: 'api.github.com',
    path: '/repos/ldat78705-hue/TT/actions/runs',
    method: 'GET',
    headers: {
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': 'Bearer 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'
    }
};

https.get(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const runs = JSON.parse(data).workflow_runs;
        if (runs && runs.length > 0) {
            const latestRun = runs[0];
            console.log("Latest run ID:", latestRun.id);
            
            https.get({
                hostname: 'api.github.com',
                path: `/repos/ldat78705-hue/TT/actions/runs/${latestRun.id}/jobs`,
                headers: { 'User-Agent': 'Node.js', 'Accept': 'application/vnd.github.v3+json', 'Authorization': 'Bearer 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' }
            }, (res2) => {
                let data2 = '';
                res2.on('data', chunk => data2 += chunk);
                res2.on('end', () => {
                    const jobs = JSON.parse(data2).jobs;
                    if (jobs && jobs.length > 0) {
                        const job = jobs[0];
                        console.log("Job ID:", job.id);
                        
                        https.get({
                            hostname: 'api.github.com',
                            path: `/repos/ldat78705-hue/TT/actions/jobs/${job.id}/logs`,
                            headers: { 'User-Agent': 'Node.js', 'Accept': 'application/vnd.github.v3+json', 'Authorization': 'Bearer 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' }
                        }, (res3) => {
                            if (res3.statusCode === 302) {
                                https.get(res3.headers.location, { headers: { 'User-Agent': 'Node.js', 'Accept': 'application/vnd.github.v3+json' } }, (res4) => {
                                    let data4 = '';
                                    res4.on('data', chunk => data4 += chunk);
                                    res4.on('end', () => {
                                        fs.writeFileSync('log.txt', data4);
                                        console.log("Saved to log.txt");
                                    });
                                });
                            } else {
                                let data3 = '';
                                res3.on('data', chunk => data3 += chunk);
                                res3.on('end', () => {
                                    fs.writeFileSync('log.txt', data3);
                                    console.log("Saved to log.txt (direct)");
                                });
                            }
                        });
                    }
                });
            });
        } else {
            console.log(data);
        }
    });
}).on('error', err => {
    console.error(err);
});
