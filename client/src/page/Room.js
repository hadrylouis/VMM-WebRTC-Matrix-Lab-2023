import React from "react";
import { useParams } from "react-router-dom";

function withParams(Component) {
    return props => <Component {...props} params={useParams()} />;
}

class Room extends React.Component {
    constructor(props) {
        super(props);
        this.call = null;
        this.state = {
            connected: false,
            chat: [],
            input: "",
            call: null,
            place: false,
            hangup: true,
            answer: true,
            result: ""
        };
    }

    componentDidMount() {
        const { client } = this.props;
        const { roomId } = this.props.params;
        client.joinRoom(roomId).then((response) => {
            console.log("Joined room %s", roomId);
            this.setState({ connected: true });

            client.on("Room.timeline", (event, room) => {
                if (event.event.type === "m.room.message") {
                    const sender = event.sender.name;
                    const message = event.event.content.body;
                    const { chat } = this.state;
                    chat.push(`${sender}: ${message}`);
                    this.setState({ chat });
                }
            });

            client.on("Call.incoming", (call, room) => {
                const { roomId } = this.props.params;
                if (call.roomId === roomId) {
                    this.setState({ result: "Call ringing..." });
                    this.addListeners(call);
                    this.setState({ call, place: true, hangup: true, answer: false });
                }
            });
        }).catch((error) => {
            console.log(error);
            this.setState({ connected: false });
        });
    }

    handleInput = (event) => {
        this.setState({ input: event.target.value });
    }

    disableButtons = (place, answer, hangup)  => {
        this.setState({ place, answer, hangup });
    }

  addListeners = (call) => {
    let lastError = "";
    call.on("hangup", () => {
        console.log("Call hangup, disabling buttons false true true");
        this.setState({ call: null, result: "Call ended. Last error: " + lastError });

        const remoteElement = document.getElementById("remoteVideo");
        const localElement = document.getElementById("localVideo");

        remoteElement.srcObject = null;
        localElement.srcObject = null;

        this.setState({ place: false, hangup: true, answer: true });
    });
    call.on("error", (err) => {
        lastError = err.message;
        call.hangup();
        console.log("Call error, disabling buttons false true true");
    });
    call.on("feeds_changed", (feeds) => {
        const localFeed = feeds.find((feed) => feed.isLocal());
        const remoteFeed = feeds.find((feed) => !feed.isLocal());

            const remoteElement = document.getElementById("remoteVideo");
            const localElement = document.getElementById("localVideo");

            if (remoteFeed) {
                remoteElement.srcObject = remoteFeed.stream;
                remoteElement.play().catch((error) => {
                    console.log(error);
                });
            }
            if (localFeed) {
                localElement.muted = true;
                localElement.srcObject = localFeed.stream;
                localElement.play().catch((error) => {
                    console.log(error);
                });
            }
        });
    }

  placeCall = () => {
    console.log("Placing call...");
    const { roomId } = this.props.params;
    const { client } = this.props;
    const call = client.createCall(roomId);
    this.disableButtons(true, true, false);
    console.log("Call => %s", call);
    this.addListeners(call);
    call.placeVideoCall();
    this.setState({ call, place: true, hangup: false });
  }

  hangup = () => {
    console.log("Hanging up call...");
    const { call } = this.state;
    this.setState({ call: null, place: false, hangup: true, answer: true });
    call.hangup();
    this.setState({result: "Hungup call."})
  }

  answer = () => {
    console.log("Answering call...");
    const { call } = this.state;
    call.answer();
    this.setState({ place: true, hangup: false, answer: true, result: "Answered call." });
    document.getElementById("result").innerHTML = "<p>Answered call.</p>";
  }

    sendMessage = (e) => {
        e.preventDefault();
        const { client } = this.props;
        const { roomId } = this.props.params;
        const { input } = this.state;
        const message = {
            "msgtype": "m.text",
            "body": input,
        }
        this.setState({ input: "" });
        client.sendEvent(roomId, "m.room.message", message).then((response) => {
            console.log("Sent message");
            console.log(response);
        }).catch((error) => {
            console.log(error);
        });
    }

  render() {
      const { connected } = this.state;

      if (!connected) {
          return <h1>Failing to connect to room</h1>;
      }

      return (
          <div id='mainDiv' align="center">
              <h1>Make free video calls</h1>
              <div id='callButtons' align="center">
                  <button id="callButton" onClick={this.placeCall} disabled={this.state.place}>Call</button>
                  <button id="hangupButton" onClick={this.hangup} disabled={this.state.hangup}>Hangup</button>
                  <button id="answerButton" onClick={this.answer} disabled={this.state.answer}>Answer</button>
              </div>
              <div id="result">{this.state.result}</div>
              <h3>Streams and data channels</h3>
              <table className="pure-table pure-table" width="90%">
                  <thead>
                      <tr>
                          <th>Local video</th>
                          <th>Remote video</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr>
                          <td width="50%"> <video id="localVideo" autoPlay playsInline width="100%"></video> </td>
                          <td width="50%"> <video id="remoteVideo" autoPlay playsInline width="100%"></video> </td>
                      </tr>
                  </tbody>
              </table>
              <div id='chat' align="center">
                  <h3>Chat</h3>
                  <form>
                    <textarea style={{width:"90%", minHeight: "300px"}} value={this.state.chat.join("\n")} readOnly disabled />
                    <input id="dataChannelInput" type="text" onChange={this.handleInput} value={this.state.input} />
                    <input id="sendButton" onClick={this.sendMessage} type="submit" value="Send" />
                  </form>
              </div>
          </div>
      );
  }
}

export default withParams(Room);