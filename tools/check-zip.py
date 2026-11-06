import zipfile

zip_path = r'C:\Users\Administrator\Desktop\鲸鱼小屋V4交付\dsh-whale-status-v4-deliverable.zip'
with zipfile.ZipFile(zip_path, 'r') as z:
    for name in z.namelist():
        if any(name.endswith(k) for k in ['build.mjs', 'panel.js', 'room-art.mjs', 'panel.css']):
            content = z.read(name).decode('utf-8', errors='ignore')
            print(f'File: {name}')
            print('  Contains LIULI / TWO STOREY HOME:', 'LIULI / TWO STOREY HOME' in content)
            print('  Contains stripModuleSyntax:', 'stripModuleSyntax' in content)
            print('  Contains walk:60000:', ('walk:60000' in content or 'walk: 60000' in content))
            print('  Contains 大肥鱼:', '大肥鱼' in content)
            print('  Contains postMessage dirty-check:', 'lastSavedSig' in content)
