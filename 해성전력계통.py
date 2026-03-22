from flask import Flask, render_template, request, redirect, url_for, session, jsonify
import json
import os

app = Flask(__name__)
app.secret_key = 'hsdstops_secret_key_2024'

# 계정 정보
ACCOUNTS = {
    'administer': {'password': 'hsdstops!', 'role': 'admin'},
    'admin':      {'password': 'hsdsinfra!', 'role': 'user'},
}

DATA_FILE = os.path.join(os.path.dirname(__file__), 'data', 'buildings.json')


def load_buildings():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_buildings(data):
    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ──────────────────────────────────────────
#  라우트
# ──────────────────────────────────────────

@app.route('/')
def index():
    if 'username' not in session:
        return redirect(url_for('login'))
    buildings = load_buildings()
    return render_template('index.html',
                           username=session['username'],
                           role=session['role'],
                           buildings=buildings)


@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        uid = request.form.get('username', '').strip()
        pwd = request.form.get('password', '').strip()
        acc = ACCOUNTS.get(uid)
        if acc and acc['password'] == pwd:
            session['username'] = uid
            session['role'] = acc['role']
            return redirect(url_for('index'))
        error = '아이디 또는 비밀번호가 올바르지 않습니다.'
    return render_template('login.html', error=error)


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ──────────────────────────────────────────
#  API – 건물 CRUD (관리자 전용)
# ──────────────────────────────────────────

@app.route('/api/buildings', methods=['GET'])
def api_get_buildings():
    if 'username' not in session:
        return jsonify({'error': 'unauthorized'}), 401
    return jsonify(load_buildings())


@app.route('/api/buildings', methods=['POST'])
def api_add_building():
    if session.get('role') != 'admin':
        return jsonify({'error': 'forbidden'}), 403
    data = request.get_json()
    buildings = load_buildings()
    new_id = max((b['id'] for b in buildings), default=0) + 1
    building = {
        'id': new_id,
        'name': data.get('name', f'건물{new_id}'),
        'x': data.get('x', 50),
        'y': data.get('y', 50),
        'floors': data.get('floors', ['1F']),
        'color': data.get('color', '#1a73e8'),
    }
    buildings.append(building)
    save_buildings(buildings)
    return jsonify(building), 201


@app.route('/api/buildings/<int:bid>', methods=['PUT'])
def api_update_building(bid):
    if session.get('role') != 'admin':
        return jsonify({'error': 'forbidden'}), 403
    data = request.get_json()
    buildings = load_buildings()
    for b in buildings:
        if b['id'] == bid:
            b.update({k: v for k, v in data.items() if k != 'id'})
            save_buildings(buildings)
            return jsonify(b)
    return jsonify({'error': 'not found'}), 404


@app.route('/api/buildings/<int:bid>', methods=['DELETE'])
def api_delete_building(bid):
    if session.get('role') != 'admin':
        return jsonify({'error': 'forbidden'}), 403
    buildings = load_buildings()
    buildings = [b for b in buildings if b['id'] != bid]
    save_buildings(buildings)
    return jsonify({'ok': True})


# ──────────────────────────────────────────
#  지도 이미지 업로드 (관리자 전용)
# ──────────────────────────────────────────

@app.route('/api/upload-map', methods=['POST'])
def api_upload_map():
    if session.get('role') != 'admin':
        return jsonify({'error': 'forbidden'}), 403
    f = request.files.get('map_image')
    if not f:
        return jsonify({'error': 'no file'}), 400
    upload_dir = os.path.join(os.path.dirname(__file__), 'static', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    save_path = os.path.join(upload_dir, 'site_map.png')
    f.save(save_path)
    return jsonify({'url': '/static/uploads/site_map.png'})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
