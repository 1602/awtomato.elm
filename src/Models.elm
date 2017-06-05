module Models exposing (..)

--import Json.Encode exposing (Value)

type alias Context =
    { id : String
    , name : String
    , selectors : List Selector
    }


type alias Page =
    { id : String
    , name : String
    , selections : List Selection
    }


type alias Selection =
    { id : String
    , name : String
    , cssSelector : String
    , attachments : List Attachment
    }


type alias Attachment =
    { id : String
    , name : String
    , cssSelector : String
    , parentOffset : Int
    }


type alias Entity =
    { primaryPick : Int
    , pickedElements : List Element
    , selector : String
    , parentOffset : Int
    , dataExtractor : Maybe DataExtractor
    }

type alias DataExtractor =
    { source : String
    }

type alias Selector =
    { name : String
    , entity : Entity
    , isCollection : Bool
    , filter : SelectionFilter
    , properties : List Property
    }

type alias Property =
    { name : String
    , entity : Entity
    , isCollection : Bool
    , filter : SelectionFilter
    }

type alias Element =
    { x : Int
    , y : Int
    , distanceToTop : Int
    , width : Int
    , height : Int
    , id : Maybe String
    , tagName : String
    , classList : List String
    , elementId : String
    , label : Maybe String
    , hasChildren : Bool
    , data : Maybe String
    , properties : List ChildElement
    }

type alias ChildElement =
    { id : Maybe String
    , tagName : String
    , classList : List String
    , label : Maybe String
    , data : Maybe String
    , name : String
    }

type alias SelectionFilter =
    (String, String, String)

