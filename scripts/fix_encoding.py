import glob

corrupted = {
    b'\xc3\xa2\xe2\x82\xac\xe2\x80\x9d': b'\xe2\x80\x94',
    b'\xc3\xa2\xe2\x82\xac\xe2\x80\x9c': b'\xe2\x80\x9c',
    b'\xc3\xa2\xe2\x82\xac\xe2\x82\xac': b'\xe2\x80\xa2',
    b'\xc3\xa2\xe2\x82\xac\xe2\x80\xa6': b'\xe2\x80\xa6',
    b'\xc3\xa2\xe2\x82\xac\xe2\x80\x98': b'\xe2\x80\x98',
    b'\xc3\xa2\xe2\x82\xac\xe2\x80\x99': b'\xe2\x80\x99',
    b'\xc3\xa2\xe2\x82\xac\xe2\x80\x93': b'\xe2\x80\x93',
    # Triple-encoded bullet: c3 a2 e2 82 ac c2 a2
    b'\xc3\xa2\xe2\x82\xac\xc2\xa2': b'\xe2\x80\xa2',
}

for pat in glob.glob('/root/zkt-app/frontend/src/**/*.tsx', recursive=True) + glob.glob('/root/zkt-app/frontend/src/**/*.ts', recursive=True):
    with open(pat, 'rb') as f:
        data = f.read()
    new_data = data
    for bad, good in corrupted.items():
        new_data = new_data.replace(bad, good)
    if new_data != data:
        with open(pat, 'wb') as f:
            f.write(new_data)
        print(f'Fixed: {pat}')

print('Done')
