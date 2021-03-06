import React from 'react';
import ReactDOM from 'react-dom';
import Api from './services/api';
import DB from './services/db';

const api = new Api();
const db = new DB();

import Login from './components/Login';
import Loading from './components/Loading';
import Entries from './components/Entries';
import Timer from './components/Timer';

class App extends React.Component {
  constructor() {
    super();

    const savedToken = db.get('token');
    if (savedToken) {
      api.setToken(savedToken);
    }

    this.state = {
      inputUser: '',
      inputPass: '',
      loginError: false,
      currentTimer: {},
      entries: [],
      projects: [],
      section: db.get('section') || 'login'
    };

    this.handlerInputChange = this.handlerInputChange.bind(this);
    this.handlerLoginAction = this.handlerLoginAction.bind(this);
    this.handlerSaveEntry = this.handlerSaveEntry.bind(this);
  }

  /*
   * Methods
   */
  loadEntries() {
    const activeTimer = api.request('/time_entries/current');
    const entries = api.request('/time_entries');
    const projects = api.request('/workspaces/' + db.get('wid') + '/projects');

    // get current app status: entries and active timer
    Promise.all([activeTimer, entries, projects]).then(result => {
      const section = 'app';

      // sort new ones on top
      result[1].sort((a, b) => new Date(b.start) - new Date(a.start));

      // hydrate entries with project info and filter unfinished ones
      let cleanEntries = [];
      result[1].forEach(entry => {
        if (!entry.stop) {
          return;
        }

        let matchedProject = {};
        if (entry.pid) {
          matchedProject = result[2].filter(project => entry.pid === project.id)[0];
        } else {
          matchedProject.name = 'Unknown Project';
          matchedProject.hex_color = '';
        }

        // no need to hydrate with whole project data
        entry.projectName = matchedProject.name;
        entry.projectColor = matchedProject.hex_color;

        cleanEntries.push(entry);
      });

      db.set('section', section);
      this.setState({
        currentTimer: result[0].data || {},
        section: section,
        entries: cleanEntries,
        projects: result[2]
      });
    });
  }

  /*
   * Common
   */
  handlerInputChange(e) {
    this.setState({
      [e.target.name]: e.target.value
    });
  }

  /*
   * Handlers
   */
  handlerLoginAction() {
    this.setState({
      section: 'loading'
    }, () => {
      api.login(this.state.inputUser, this.state.inputPass).then(response => {
        db.set('token', response.api_token);
        db.set('wid', response.default_wid);

        this.setState({
          inputUser: '',
          inputPass: '',
          authError: false
        });

        this.loadEntries();
      }).catch(() => {
        this.setState({
          authError: true,
          section: 'login'
        });
      });
    });
  }

  handlerSaveEntry(newEntry) {
    let entries = this.state.entries;
    entries.unshift(newEntry);

    this.setState({
      entries: entries
    });
  }

  /*
   * Render
   */
  componentDidMount() {
    if (this.state.section === 'app') {
      this.setState({
        section: 'loading'
      }, () => {
        this.loadEntries();
      });
    }
  }

  render() {
    let view;

    // State-of-the-art router 😂
    if (this.state.section === 'login') {
      view = <Login onLogin={this.handlerLoginAction} onInputChange={this.handlerInputChange} authError={this.state.authError} />;
    } else if (this.state.section === 'loading') {
      view = <Loading />;
    } else if (this.state.section === 'app') {
      view = <div>
        <Entries entries={this.state.entries} />
        <Timer current={this.state.currentTimer} onSave={this.handlerSaveEntry} api={api} wid={db.get('wid')} />
      </div>;
    }

    return <div className="appContainer">{view}</div>;
  }
}

ReactDOM.render(<App />, document.getElementById('root'));
