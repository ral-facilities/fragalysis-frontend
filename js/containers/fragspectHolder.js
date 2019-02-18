import React, {Component} from "react";
import {connect} from "react-redux";
import {Row, Col} from "react-bootstrap";
import FragspectList from "../components/fragspectList";
import ModalFragspectEventView from "./modalFragspectEventView";

class Fragspect extends Component {

    constructor(props) {
        super(props)
    }

    render() {
        var screenHeight= window.innerHeight*0.7.toString()+"px"
        return (
            <Row>
                <FragspectList height={screenHeight} style={{overflow: scroll}}/>
                <ModalFragspectEventView/>
            </Row>
        )
    }
}

function mapStateToProps(state) {
  return {
  }
}

export default connect(mapStateToProps)(Fragspect)